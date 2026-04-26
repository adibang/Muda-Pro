// controllers/inventoryController.js
const { db } = require('../config/database');
const { successResponse, errorResponse } = require('../utils/response');

// Fungsi bantu: update stok gudang dan catat mutasi
function updateStok(produk_id, varian_id, gudang_id, delta, tipe, referensi, userId, catatan = '') {
  let stokRow;
  if (varian_id === null || varian_id === undefined) {
    stokRow = db.get(
      'SELECT id, stok FROM stok_gudang WHERE produk_id = ? AND varian_id IS NULL AND gudang_id = ?',
      [produk_id, gudang_id]
    );
  } else {
    stokRow = db.get(
      'SELECT id, stok FROM stok_gudang WHERE produk_id = ? AND varian_id = ? AND gudang_id = ?',
      [produk_id, varian_id, gudang_id]
    );
  }

  const stokSebelum = stokRow ? stokRow.stok : 0;
  const stokSesudah = stokSebelum + delta;

  if (stokSesudah < 0) {
    throw new Error('Stok tidak mencukupi untuk operasi ini');
  }

  if (stokRow) {
    db.run(
      `UPDATE stok_gudang SET stok = ?, updated_at = datetime('now','localtime') WHERE id = ?`,
      [stokSesudah, stokRow.id]
    );
  } else {
    db.run(
      'INSERT INTO stok_gudang (produk_id, varian_id, gudang_id, stok) VALUES (?, ?, ?, ?)',
      [produk_id, varian_id, gudang_id, stokSesudah]
    );
  }

  // Catat mutasi
  db.run(
    `INSERT INTO mutasi_stok (tipe, produk_id, varian_id, gudang_id, kuantitas, stok_sebelum, stok_sesudah, referensi, user_id, catatan)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [tipe, produk_id, varian_id, gudang_id, delta, stokSebelum, stokSesudah, referensi, userId, catatan]
  );
}

const inventoryController = {
  // =================== STOK MASUK ===================
  stockIn: (req, res) => {
    try {
      const { gudang_id, items, catatan } = req.body;
      if (!gudang_id || !Array.isArray(items) || items.length === 0) {
        return errorResponse(res, 'gudang_id dan items diperlukan', 400);
      }
      const userId = req.user.id;

      for (const item of items) {
        const { produk_id, varian_id = null, kuantitas } = item;
        if (!produk_id || !kuantitas || kuantitas <= 0) {
          return errorResponse(res, 'Setiap item harus memiliki produk_id dan kuantitas > 0', 400);
        }
        // Validasi produk/varian ada
        const produk = db.get('SELECT id FROM produk WHERE id = ? AND deleted = 0', [produk_id]);
        if (!produk) return errorResponse(res, `Produk id ${produk_id} tidak ditemukan`, 404);
        if (varian_id) {
          const varian = db.get('SELECT id FROM varian_produk WHERE id = ? AND produk_id = ? AND deleted = 0', [varian_id, produk_id]);
          if (!varian) return errorResponse(res, `Varian id ${varian_id} tidak valid`, 404);
        }
        updateStok(produk_id, varian_id, gudang_id, kuantitas, 'masuk', null, userId, catatan || 'Stok masuk');
      }

      return successResponse(res, null, 'Stok masuk berhasil dicatat', 201);
    } catch (error) {
      return errorResponse(res, error.message, 500);
    }
  },

  // =================== STOK KELUAR ===================
  stockOut: (req, res) => {
    try {
      const { gudang_id, items, catatan } = req.body;
      if (!gudang_id || !Array.isArray(items) || items.length === 0) {
        return errorResponse(res, 'gudang_id dan items diperlukan', 400);
      }
      const userId = req.user.id;

      for (const item of items) {
        const { produk_id, varian_id = null, kuantitas } = item;
        if (!produk_id || !kuantitas || kuantitas <= 0) {
          return errorResponse(res, 'Setiap item harus memiliki produk_id dan kuantitas > 0', 400);
        }
        updateStok(produk_id, varian_id, gudang_id, -kuantitas, 'keluar', null, userId, catatan || 'Stok keluar');
      }

      return successResponse(res, null, 'Stok keluar berhasil dicatat', 201);
    } catch (error) {
      return errorResponse(res, error.message, 500);
    }
  },

  // =================== TRANSFER ===================
  createTransfer: (req, res) => {
    try {
      const { gudang_asal_id, gudang_tujuan_id, items, catatan } = req.body;
      if (!gudang_asal_id || !gudang_tujuan_id || !Array.isArray(items) || items.length === 0) {
        return errorResponse(res, 'gudang_asal_id, gudang_tujuan_id, dan items diperlukan', 400);
      }
      if (gudang_asal_id === gudang_tujuan_id) {
        return errorResponse(res, 'Gudang asal dan tujuan tidak boleh sama', 400);
      }
      const userId = req.user.id;

      // Buat header transfer dengan nomor sementara
      const tempNo = 'TF-' + Date.now();
      db.run(
        `INSERT INTO transfer (nomor, gudang_asal_id, gudang_tujuan_id, status, user_id, catatan)
         VALUES (?, ?, ?, 'draft', ?, ?)`,
        [tempNo, gudang_asal_id, gudang_tujuan_id, userId, catatan || '']
      );

      const tf = db.get('SELECT id FROM transfer WHERE nomor = ?', [tempNo]);
      if (!tf) throw new Error('Gagal membuat transfer');
      const transferId = tf.id;

      const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const nomorFinal = `TF-${today}-${String(transferId).padStart(4, '0')}`;
      db.run('UPDATE transfer SET nomor = ? WHERE id = ?', [nomorFinal, transferId]);

      // Insert detail
      for (const item of items) {
        const { produk_id, varian_id = null, kuantitas } = item;
        if (!produk_id || !kuantitas || kuantitas <= 0) {
          db.run('DELETE FROM transfer WHERE id = ?', [transferId]);
          return errorResponse(res, 'Setiap item harus memiliki produk_id dan kuantitas > 0', 400);
        }
        db.run(
          'INSERT INTO transfer_detail (transfer_id, produk_id, varian_id, kuantitas) VALUES (?, ?, ?, ?)',
          [transferId, produk_id, varian_id, kuantitas]
        );
      }

      const data = { id: transferId, nomor: nomorFinal };
      return successResponse(res, data, 'Transfer draft berhasil dibuat', 201);
    } catch (error) {
      return errorResponse(res, error.message, 500);
    }
  },

  getTransfer: (req, res) => {
    try {
      const transfers = db.all(
        `SELECT t.*, g1.nama AS gudang_asal, g2.nama AS gudang_tujuan
         FROM transfer t
         LEFT JOIN gudang g1 ON t.gudang_asal_id = g1.id
         LEFT JOIN gudang g2 ON t.gudang_tujuan_id = g2.id
         ORDER BY t.created_at DESC`
      );
      return successResponse(res, transfers, 'Daftar transfer');
    } catch (error) {
      return errorResponse(res, error.message, 500);
    }
  },

  getTransferById: (req, res) => {
    try {
      const { id } = req.params;
      const transfer = db.get(
        `SELECT t.*, g1.nama AS gudang_asal, g2.nama AS gudang_tujuan
         FROM transfer t
         LEFT JOIN gudang g1 ON t.gudang_asal_id = g1.id
         LEFT JOIN gudang g2 ON t.gudang_tujuan_id = g2.id
         WHERE t.id = ?`, [id]
      );
      if (!transfer) return errorResponse(res, 'Transfer tidak ditemukan', 404);

      const details = db.all(
        `SELECT td.*, p.nama AS produk_nama, v.nama_varian
         FROM transfer_detail td
         LEFT JOIN produk p ON td.produk_id = p.id
         LEFT JOIN varian_produk v ON td.varian_id = v.id
         WHERE td.transfer_id = ?`, [id]
      );
      transfer.detail = details;
      return successResponse(res, transfer, 'Detail transfer');
    } catch (error) {
      return errorResponse(res, error.message, 500);
    }
  },

  completeTransfer: (req, res) => {
    try {
      const { id } = req.params;
      const transfer = db.get('SELECT * FROM transfer WHERE id = ?', [id]);
      if (!transfer) return errorResponse(res, 'Transfer tidak ditemukan', 404);
      if (transfer.status !== 'draft') return errorResponse(res, 'Hanya transfer draft yang dapat diselesaikan', 400);

      const details = db.all('SELECT * FROM transfer_detail WHERE transfer_id = ?', [id]);
      if (details.length === 0) return errorResponse(res, 'Transfer tidak memiliki item', 400);

      // Validasi stok asal
      for (const item of details) {
        let stokRow;
        if (item.varian_id === null || item.varian_id === undefined) {
          stokRow = db.get(
            'SELECT stok FROM stok_gudang WHERE produk_id = ? AND varian_id IS NULL AND gudang_id = ?',
            [item.produk_id, transfer.gudang_asal_id]
          );
        } else {
          stokRow = db.get(
            'SELECT stok FROM stok_gudang WHERE produk_id = ? AND varian_id = ? AND gudang_id = ?',
            [item.produk_id, item.varian_id, transfer.gudang_asal_id]
          );
        }
        const stokTersedia = stokRow ? stokRow.stok : 0;
        if (stokTersedia < item.kuantitas) {
          return errorResponse(res, `Stok produk ${item.produk_id} varian ${item.varian_id} di gudang asal tidak mencukupi`, 400);
        }
      }

      const userId = req.user.id;
      for (const item of details) {
        updateStok(item.produk_id, item.varian_id, transfer.gudang_asal_id, -item.kuantitas,
                   'transfer_keluar', transfer.nomor, userId, `Transfer ke ${transfer.gudang_tujuan_id}`);
        updateStok(item.produk_id, item.varian_id, transfer.gudang_tujuan_id, item.kuantitas,
                   'transfer_masuk', transfer.nomor, userId, `Transfer dari ${transfer.gudang_asal_id}`);
      }

      db.run('UPDATE transfer SET status = \'completed\', updated_at = datetime(\'now\',\'localtime\') WHERE id = ?', [id]);
      return successResponse(res, null, 'Transfer berhasil diselesaikan');
    } catch (error) {
      return errorResponse(res, error.message, 500);
    }
  },

  cancelTransfer: (req, res) => {
    try {
      const { id } = req.params;
      const transfer = db.get('SELECT * FROM transfer WHERE id = ?', [id]);
      if (!transfer) return errorResponse(res, 'Transfer tidak ditemukan', 404);
      if (transfer.status !== 'draft') return errorResponse(res, 'Hanya draft yang bisa dibatalkan', 400);

      db.run('UPDATE transfer SET status = \'cancelled\', updated_at = datetime(\'now\',\'localtime\') WHERE id = ?', [id]);
      return successResponse(res, null, 'Transfer dibatalkan');
    } catch (error) {
      return errorResponse(res, error.message, 500);
    }
  },

  // =================== STOK OPNAME ===================
  createOpname: (req, res) => {
    try {
      const { gudang_id, catatan } = req.body;
      if (!gudang_id) return errorResponse(res, 'gudang_id diperlukan', 400);

      const userId = req.user.id;
      const tempNo = 'OP-' + Date.now();
      db.run(
        `INSERT INTO stok_opname (nomor, gudang_id, status, user_id, catatan)
         VALUES (?, ?, 'draft', ?, ?)`,
        [tempNo, gudang_id, userId, catatan || '']
      );
      const op = db.get('SELECT id FROM stok_opname WHERE nomor = ?', [tempNo]);
      if (!op) throw new Error('Gagal membuat stok opname');

      const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const nomorFinal = `OP-${today}-${String(op.id).padStart(4, '0')}`;
      db.run('UPDATE stok_opname SET nomor = ? WHERE id = ?', [nomorFinal, op.id]);

      const data = { id: op.id, nomor: nomorFinal };
      return successResponse(res, data, 'Stok opname draft dibuat', 201);
    } catch (error) {
      return errorResponse(res, error.message, 500);
    }
  },

  getOpname: (req, res) => {
    try {
      const list = db.all(
        `SELECT o.*, g.nama AS gudang_nama
         FROM stok_opname o
         JOIN gudang g ON o.gudang_id = g.id
         ORDER BY o.created_at DESC`
      );
      return successResponse(res, list, 'Daftar stok opname');
    } catch (error) {
      return errorResponse(res, error.message, 500);
    }
  },

  getOpnameById: (req, res) => {
    try {
      const { id } = req.params;
      const opname = db.get(
        `SELECT o.*, g.nama AS gudang_nama
         FROM stok_opname o
         JOIN gudang g ON o.gudang_id = g.id
         WHERE o.id = ?`, [id]
      );
      if (!opname) return errorResponse(res, 'Stok opname tidak ditemukan', 404);

      const details = db.all(
        `SELECT d.*, p.nama AS produk_nama, v.nama_varian
         FROM stok_opname_detail d
         LEFT JOIN produk p ON d.produk_id = p.id
         LEFT JOIN varian_produk v ON d.varian_id = v.id
         WHERE d.opname_id = ?`, [id]
      );
      opname.detail = details;
      return successResponse(res, opname, 'Detail stok opname');
    } catch (error) {
      return errorResponse(res, error.message, 500);
    }
  },

  addOpnameDetail: (req, res) => {
    try {
      const { id } = req.params;
      const { items } = req.body;
      if (!Array.isArray(items) || items.length === 0) {
        return errorResponse(res, 'items diperlukan', 400);
      }

      const opname = db.get('SELECT * FROM stok_opname WHERE id = ? AND status = \'draft\'', [id]);
      if (!opname) return errorResponse(res, 'Opname tidak ditemukan atau bukan draft', 404);

      const gudang_id = opname.gudang_id;

      for (const item of items) {
        const { produk_id, varian_id = null, stok_fisik } = item;
        const stok = db.get(
          'SELECT stok FROM stok_gudang WHERE produk_id = ? AND varian_id IS ? AND gudang_id = ?',
          [produk_id, varian_id, gudang_id]
        );
        const stokSistem = stok ? stok.stok : 0;
        const selisih = stok_fisik - stokSistem;

        const existingDetail = db.get(
          'SELECT id FROM stok_opname_detail WHERE opname_id = ? AND produk_id = ? AND varian_id IS ?',
          [id, produk_id, varian_id]
        );
        if (existingDetail) {
          db.run(
            'UPDATE stok_opname_detail SET stok_sistem = ?, stok_fisik = ?, selisih = ? WHERE id = ?',
            [stokSistem, stok_fisik, selisih, existingDetail.id]
          );
        } else {
          db.run(
            'INSERT INTO stok_opname_detail (opname_id, produk_id, varian_id, stok_sistem, stok_fisik, selisih) VALUES (?, ?, ?, ?, ?, ?)',
            [id, produk_id, varian_id, stokSistem, stok_fisik, selisih]
          );
        }
      }

      return successResponse(res, null, 'Detail opname berhasil ditambahkan/diperbarui');
    } catch (error) {
      return errorResponse(res, error.message, 500);
    }
  },

  completeOpname: (req, res) => {
    try {
      const { id } = req.params;
      const opname = db.get('SELECT * FROM stok_opname WHERE id = ? AND status = \'draft\'', [id]);
      if (!opname) return errorResponse(res, 'Opname tidak ditemukan atau bukan draft', 404);

      const details = db.all('SELECT * FROM stok_opname_detail WHERE opname_id = ?', [id]);
      if (details.length === 0) return errorResponse(res, 'Opname tidak memiliki detail', 400);

      const userId = req.user.id;
      for (const d of details) {
        if (d.selisih !== 0) {
          const tipe = d.selisih > 0 ? 'opname_masuk' : 'opname_keluar';
          updateStok(d.produk_id, d.varian_id, opname.gudang_id, d.selisih,
                     tipe, opname.nomor, userId, 'Penyesuaian opname');
        }
      }

      db.run('UPDATE stok_opname SET status = \'completed\', updated_at = datetime(\'now\',\'localtime\') WHERE id = ?', [id]);
      return successResponse(res, null, 'Stok opname selesai dan stok disesuaikan');
    } catch (error) {
      return errorResponse(res, error.message, 500);
    }
  },

  cancelOpname: (req, res) => {
    try {
      const { id } = req.params;
      const opname = db.get('SELECT * FROM stok_opname WHERE id = ? AND status = \'draft\'', [id]);
      if (!opname) return errorResponse(res, 'Opname tidak ditemukan atau bukan draft', 404);

      db.run('UPDATE stok_opname SET status = \'cancelled\', updated_at = datetime(\'now\',\'localtime\') WHERE id = ?', [id]);
      return successResponse(res, null, 'Stok opname dibatalkan');
    } catch (error) {
      return errorResponse(res, error.message, 500);
    }
  },

  // =================== RIWAYAT MUTASI ===================
  getMutation: (req, res) => {
    try {
      let sql = `SELECT m.*, p.nama AS produk_nama, v.nama_varian, g.nama AS gudang_nama
                 FROM mutasi_stok m
                 LEFT JOIN produk p ON m.produk_id = p.id
                 LEFT JOIN varian_produk v ON m.varian_id = v.id
                 LEFT JOIN gudang g ON m.gudang_id = g.id
                 WHERE 1=1`;
      const params = [];
      if (req.query.tipe) {
        sql += ' AND m.tipe = ?';
        params.push(req.query.tipe);
      }
      if (req.query.produk_id) {
        sql += ' AND m.produk_id = ?';
        params.push(req.query.produk_id);
      }
      if (req.query.gudang_id) {
        sql += ' AND m.gudang_id = ?';
        params.push(req.query.gudang_id);
      }
      if (req.query.start_date) {
        sql += ' AND m.tanggal >= ?';
        params.push(req.query.start_date);
      }
      if (req.query.end_date) {
        sql += ' AND m.tanggal <= ?';
        params.push(req.query.end_date);
      }
      sql += ' ORDER BY m.created_at DESC LIMIT 200';

      const rows = db.all(sql, params);
      return successResponse(res, rows, 'Riwayat mutasi stok');
    } catch (error) {
      return errorResponse(res, error.message, 500);
    }
  },

  // =================== STOK SAAT INI ===================
  getStock: (req, res) => {
    try {
      let sql = `SELECT sg.*, p.nama AS produk_nama, v.nama_varian, g.nama AS gudang_nama
                 FROM stok_gudang sg
                 LEFT JOIN produk p ON sg.produk_id = p.id
                 LEFT JOIN varian_produk v ON sg.varian_id = v.id
                 LEFT JOIN gudang g ON sg.gudang_id = g.id
                 WHERE 1=1`;
      const params = [];
      if (req.query.produk_id) {
        sql += ' AND sg.produk_id = ?';
        params.push(req.query.produk_id);
      }
      if (req.query.gudang_id) {
        sql += ' AND sg.gudang_id = ?';
        params.push(req.query.gudang_id);
      }
      sql += ' ORDER BY sg.produk_id, sg.gudang_id';
      const rows = db.all(sql, params);
      return successResponse(res, rows, 'Data stok per gudang');
    } catch (error) {
      return errorResponse(res, error.message, 500);
    }
  }
};

module.exports = inventoryController;