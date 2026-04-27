const { db } = require('../config/database');
const { successResponse, errorResponse } = require('../utils/response');

// Salinan fungsi updateStok (identik dengan di inventory/sales)
function updateStok(produk_id, varian_id, gudang_id, delta, tipe, referensi, userId, catatan = '', tenantId) {
  let stokRow;
  if (varian_id === null || varian_id === undefined) {
    stokRow = db.get(
      'SELECT id, stok FROM stok_gudang WHERE produk_id = ? AND varian_id IS NULL AND gudang_id = ? AND tenant_id = ?',
      [produk_id, gudang_id, tenantId]
    );
  } else {
    stokRow = db.get(
      'SELECT id, stok FROM stok_gudang WHERE produk_id = ? AND varian_id = ? AND gudang_id = ? AND tenant_id = ?',
      [produk_id, varian_id, gudang_id, tenantId]
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
      'INSERT INTO stok_gudang (tenant_id, produk_id, varian_id, gudang_id, stok) VALUES (?, ?, ?, ?, ?)',
      [tenantId, produk_id, varian_id, gudang_id, stokSesudah]
    );
  }

  db.run(
    `INSERT INTO mutasi_stok (tenant_id, tipe, produk_id, varian_id, gudang_id, kuantitas, stok_sebelum, stok_sesudah, referensi, user_id, catatan)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [tenantId, tipe, produk_id, varian_id, gudang_id, delta, stokSebelum, stokSesudah, referensi, userId, catatan]
  );
}

const purchaseController = {
  // =================== PURCHASE ORDER ===================
  createPO: (req, res) => {
    try {
      const tenantId = req.user.tenant_id;
      const userId = req.user.id;
      const { supplier_id, gudang_id = 1, items, catatan } = req.body;
      if (!supplier_id || !Array.isArray(items) || items.length === 0) {
        return errorResponse(res, 'supplier_id dan items diperlukan', 400);
      }

      // Validasi supplier (pastikan milik tenant ini)
      const supplier = db.get('SELECT id FROM supplier WHERE id = ? AND tenant_id = ? AND deleted = 0', [supplier_id, tenantId]);
      if (!supplier) return errorResponse(res, 'Supplier tidak ditemukan', 404);

      // Validasi gudang (harus milik tenant)
      const gudang = db.get('SELECT id FROM gudang WHERE id = ? AND tenant_id = ? AND deleted = 0', [gudang_id, tenantId]);
      if (!gudang) return errorResponse(res, 'Gudang tidak ditemukan', 404);

      // Hitung total
      let total = 0;
      const detailList = [];
      for (const item of items) {
        const { produk_id, varian_id = null, kuantitas, harga_beli } = item;
        if (!produk_id || !kuantitas || kuantitas <= 0 || !harga_beli) {
          return errorResponse(res, 'Setiap item harus memiliki produk_id, kuantitas > 0, dan harga_beli', 400);
        }
        // Validasi produk (milik tenant)
        const produk = db.get('SELECT id FROM produk WHERE id = ? AND tenant_id = ? AND deleted = 0', [produk_id, tenantId]);
        if (!produk) return errorResponse(res, `Produk id ${produk_id} tidak ditemukan`, 404);
        if (varian_id) {
          const varian = db.get('SELECT id FROM varian_produk WHERE id = ? AND produk_id = ? AND deleted = 0', [varian_id, produk_id]);
          if (!varian) return errorResponse(res, `Varian id ${varian_id} tidak valid`, 404);
        }
        const subtotal = kuantitas * harga_beli;
        detailList.push({ produk_id, varian_id, kuantitas, harga_beli, subtotal });
        total += subtotal;
      }

      // Buat PO dengan nomor sementara
      const tempNo = 'PO-' + Date.now();
      db.run(
        `INSERT INTO purchase_order (tenant_id, nomor, supplier_id, gudang_id, user_id, total, catatan)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [tenantId, tempNo, supplier_id, gudang_id, userId, total, catatan || '']
      );

      const po = db.get('SELECT id FROM purchase_order WHERE nomor = ?', [tempNo]);
      if (!po) throw new Error('Gagal membuat PO');
      const poId = po.id;

      const today = new Date().toISOString().slice(0,10).replace(/-/g,'');
      const nomorFinal = `PO-${today}-${String(poId).padStart(4,'0')}`;
      db.run('UPDATE purchase_order SET nomor = ? WHERE id = ?', [nomorFinal, poId]);

      // Insert detail
      for (const d of detailList) {
        db.run(
          `INSERT INTO purchase_order_detail (tenant_id, po_id, produk_id, varian_id, kuantitas, harga_beli, subtotal)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [tenantId, poId, d.produk_id, d.varian_id, d.kuantitas, d.harga_beli, d.subtotal]
        );
      }

      return successResponse(res, { id: poId, nomor: nomorFinal }, 'Purchase Order berhasil dibuat', 201);
    } catch (error) {
      return errorResponse(res, error.message, 500);
    }
  },

  getAllPO: (req, res) => {
    try {
      const tenantId = req.user.tenant_id;
      let sql = `SELECT po.*, s.nama AS supplier_nama, g.nama AS gudang_nama
                 FROM purchase_order po
                 LEFT JOIN supplier s ON po.supplier_id = s.id
                 LEFT JOIN gudang g ON po.gudang_id = g.id
                 WHERE po.tenant_id = ?`;
      const params = [tenantId];
      if (req.query.status) {
        sql += ' AND po.status = ?';
        params.push(req.query.status);
      }
      if (req.query.supplier_id) {
        sql += ' AND po.supplier_id = ?';
        params.push(req.query.supplier_id);
      }
      sql += ' ORDER BY po.created_at DESC';
      const rows = db.all(sql, params);
      return successResponse(res, rows, 'Daftar Purchase Order');
    } catch (error) {
      return errorResponse(res, error.message, 500);
    }
  },

  getPOById: (req, res) => {
    try {
      const tenantId = req.user.tenant_id;
      const { id } = req.params;
      const po = db.get(
        `SELECT po.*, s.nama AS supplier_nama, g.nama AS gudang_nama
         FROM purchase_order po
         LEFT JOIN supplier s ON po.supplier_id = s.id
         LEFT JOIN gudang g ON po.gudang_id = g.id
         WHERE po.id = ? AND po.tenant_id = ?`, [id, tenantId]
      );
      if (!po) return errorResponse(res, 'PO tidak ditemukan', 404);

      const details = db.all(
        `SELECT pod.*, p.nama AS produk_nama, v.nama_varian
         FROM purchase_order_detail pod
         LEFT JOIN produk p ON pod.produk_id = p.id
         LEFT JOIN varian_produk v ON pod.varian_id = v.id
         WHERE pod.po_id = ?`, [id]
      );
      po.detail = details;
      return successResponse(res, po, 'Detail Purchase Order');
    } catch (error) {
      return errorResponse(res, error.message, 500);
    }
  },

  updatePOStatus: (req, res) => {
    try {
      const tenantId = req.user.tenant_id;
      const { id } = req.params;
      const { status } = req.body;
      if (!['draft','dikirim','diterima','batal'].includes(status)) {
        return errorResponse(res, 'Status tidak valid', 400);
      }
      const po = db.get('SELECT * FROM purchase_order WHERE id = ? AND tenant_id = ?', [id, tenantId]);
      if (!po) return errorResponse(res, 'PO tidak ditemukan', 404);
      db.run('UPDATE purchase_order SET status = ?, updated_at = datetime(\'now\',\'localtime\') WHERE id = ?', [status, id]);
      return successResponse(res, null, 'Status PO diperbarui');
    } catch (error) {
      return errorResponse(res, error.message, 500);
    }
  },

  // =================== PENERIMAAN BARANG ===================
  receiveGoods: (req, res) => {
    try {
      const tenantId = req.user.tenant_id;
      const userId = req.user.id;
      const { po_id, supplier_id, gudang_id = 1, items, catatan } = req.body;
      if (!Array.isArray(items) || items.length === 0) {
        return errorResponse(res, 'items diperlukan', 400);
      }

      // Validasi PO jika ada
      if (po_id) {
        const po = db.get('SELECT * FROM purchase_order WHERE id = ? AND tenant_id = ?', [po_id, tenantId]);
        if (!po) return errorResponse(res, 'PO tidak ditemukan', 404);
      } else if (supplier_id) {
        // Validasi supplier
        const supplier = db.get('SELECT id FROM supplier WHERE id = ? AND tenant_id = ? AND deleted = 0', [supplier_id, tenantId]);
        if (!supplier) return errorResponse(res, 'Supplier tidak ditemukan', 404);
      }

      // Validasi gudang
      const gudang = db.get('SELECT id FROM gudang WHERE id = ? AND tenant_id = ? AND deleted = 0', [gudang_id, tenantId]);
      if (!gudang) return errorResponse(res, 'Gudang tidak ditemukan', 404);

      // Buat penerimaan
      const tempNo = 'RCV-' + Date.now();
      db.run(
        `INSERT INTO penerimaan (tenant_id, nomor, po_id, supplier_id, gudang_id, user_id, catatan)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [tenantId, tempNo, po_id || null, supplier_id || null, gudang_id, userId, catatan || '']
      );

      const rcv = db.get('SELECT id FROM penerimaan WHERE nomor = ?', [tempNo]);
      if (!rcv) throw new Error('Gagal membuat penerimaan');
      const rcvId = rcv.id;

      const today = new Date().toISOString().slice(0,10).replace(/-/g,'');
      const nomorFinal = `RCV-${today}-${String(rcvId).padStart(4,'0')}`;
      db.run('UPDATE penerimaan SET nomor = ? WHERE id = ?', [nomorFinal, rcvId]);

      // Proses item
      for (const item of items) {
        const { produk_id, varian_id = null, kuantitas, harga_beli } = item;
        if (!produk_id || !kuantitas || kuantitas <= 0) {
          db.run('DELETE FROM penerimaan WHERE id = ?', [rcvId]);
          return errorResponse(res, 'Setiap item harus memiliki produk_id dan kuantitas > 0', 400);
        }

        // Validasi produk (milik tenant)
        const produk = db.get('SELECT id FROM produk WHERE id = ? AND tenant_id = ? AND deleted = 0', [produk_id, tenantId]);
        if (!produk) {
          db.run('DELETE FROM penerimaan WHERE id = ?', [rcvId]);
          return errorResponse(res, `Produk id ${produk_id} tidak ditemukan`, 404);
        }

        db.run(
          `INSERT INTO penerimaan_detail (tenant_id, penerimaan_id, produk_id, varian_id, kuantitas, harga_beli)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [tenantId, rcvId, produk_id, varian_id, kuantitas, harga_beli || null]
        );

        // Update stok & mutasi
        updateStok(
          produk_id, varian_id, gudang_id, kuantitas,
          'masuk', nomorFinal, userId,
          `Penerimaan barang (${nomorFinal})`,
          tenantId
        );
      }

      return successResponse(res, { id: rcvId, nomor: nomorFinal }, 'Penerimaan barang berhasil', 201);
    } catch (error) {
      return errorResponse(res, error.message, 500);
    }
  },

  getAllPenerimaan: (req, res) => {
    try {
      const tenantId = req.user.tenant_id;
      const rows = db.all(
        `SELECT pn.*, po.nomor AS po_nomor, s.nama AS supplier_nama, g.nama AS gudang_nama
         FROM penerimaan pn
         LEFT JOIN purchase_order po ON pn.po_id = po.id
         LEFT JOIN supplier s ON pn.supplier_id = s.id
         LEFT JOIN gudang g ON pn.gudang_id = g.id
         WHERE pn.tenant_id = ?
         ORDER BY pn.created_at DESC`, [tenantId]
      );
      return successResponse(res, rows, 'Daftar Penerimaan');
    } catch (error) {
      return errorResponse(res, error.message, 500);
    }
  },

  getPenerimaanById: (req, res) => {
    try {
      const tenantId = req.user.tenant_id;
      const { id } = req.params;
      const pn = db.get(
        `SELECT pn.*, po.nomor AS po_nomor, s.nama AS supplier_nama, g.nama AS gudang_nama
         FROM penerimaan pn
         LEFT JOIN purchase_order po ON pn.po_id = po.id
         LEFT JOIN supplier s ON pn.supplier_id = s.id
         LEFT JOIN gudang g ON pn.gudang_id = g.id
         WHERE pn.id = ? AND pn.tenant_id = ?`, [id, tenantId]
      );
      if (!pn) return errorResponse(res, 'Penerimaan tidak ditemukan', 404);

      const details = db.all(
        `SELECT pd.*, p.nama AS produk_nama, v.nama_varian
         FROM penerimaan_detail pd
         LEFT JOIN produk p ON pd.produk_id = p.id
         LEFT JOIN varian_produk v ON pd.varian_id = v.id
         WHERE pd.penerimaan_id = ?`, [id]
      );
      pn.detail = details;
      return successResponse(res, pn, 'Detail Penerimaan');
    } catch (error) {
      return errorResponse(res, error.message, 500);
    }
  }
};

module.exports = purchaseController;