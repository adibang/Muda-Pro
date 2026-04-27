const { db } = require('../config/database');
const { successResponse, errorResponse } = require('../utils/response');

const produkController = {
  // =================== LIST PRODUK ===================
  getAll: (req, res) => {
    try {
      const tenantId = req.user.tenant_id;
      let sql = `SELECT p.*, k.nama AS kategori_nama, s.nama AS satuan_nama, g.nama AS gudang_nama
                 FROM produk p
                 LEFT JOIN kategori k ON p.kategori_id = k.id AND k.deleted = 0
                 LEFT JOIN satuan s ON p.satuan_id = s.id AND s.deleted = 0
                 LEFT JOIN gudang g ON p.gudang_id = g.id AND g.deleted = 0
                 WHERE p.tenant_id = ? AND p.deleted = 0`;
      const params = [tenantId];

      if (req.query.search) {
        sql += ` AND (p.kode LIKE ? OR p.nama LIKE ? OR p.barcode LIKE ?)`;
        const s = `%${req.query.search}%`;
        params.push(s, s, s);
      }
      if (req.query.kategori_id) {
        sql += ` AND p.kategori_id = ?`;
        params.push(req.query.kategori_id);
      }
      if (req.query.gudang_id) {
        sql += ` AND p.gudang_id = ?`;
        params.push(req.query.gudang_id);
      }
      sql += ` ORDER BY p.nama ASC`;

      const produk = db.all(sql, params);
      return successResponse(res, produk, 'Daftar produk berhasil diambil');
    } catch (error) {
      return errorResponse(res, error.message, 500);
    }
  },

  // =================== DETAIL PRODUK ===================
  getById: (req, res) => {
    try {
      const { id } = req.params;
      const tenantId = req.user.tenant_id;
      const produk = db.get(
        `SELECT p.*, k.nama AS kategori_nama, s.nama AS satuan_nama, g.nama AS gudang_nama
         FROM produk p
         LEFT JOIN kategori k ON p.kategori_id = k.id AND k.deleted = 0
         LEFT JOIN satuan s ON p.satuan_id = s.id AND s.deleted = 0
         LEFT JOIN gudang g ON p.gudang_id = g.id AND g.deleted = 0
         WHERE p.id = ? AND p.tenant_id = ? AND p.deleted = 0`,
        [id, tenantId]
      );
      if (!produk) return errorResponse(res, 'Produk tidak ditemukan', 404);

      // Varian & Satuan
      produk.varian = db.all(`SELECT * FROM varian_produk WHERE produk_id = ? AND deleted = 0`, [id]);
      produk.satuan = db.all(
        `SELECT ps.*, st.nama AS satuan_nama
         FROM produk_satuan ps JOIN satuan st ON ps.satuan_id = st.id AND st.deleted = 0
         WHERE ps.produk_id = ? AND ps.varian_id IS NULL AND ps.deleted = 0`, [id]
      );
      for (const v of produk.varian) {
        v.satuan = db.all(
          `SELECT ps.*, st.nama AS satuan_nama
           FROM produk_satuan ps JOIN satuan st ON ps.satuan_id = st.id AND st.deleted = 0
           WHERE ps.varian_id = ? AND ps.deleted = 0`, [v.id]
        );
      }

      return successResponse(res, produk, 'Detail produk berhasil diambil');
    } catch (error) {
      return errorResponse(res, error.message, 500);
    }
  },

  // =================== TAMBAH PRODUK ===================
  create: (req, res) => {
    try {
      const tenantId = req.user.tenant_id;
      const {
        kode, nama, barcode, harga_dasar, harga_jual,
        berat, diskon, stok_awal, stok_minimal,
        produk_timbangan, kategori_id, satuan_id, gudang_id,
        varian, satuan
      } = req.body;

      if (!kode || !nama) return errorResponse(res, 'Kode dan nama wajib diisi', 400);
      if (harga_jual === undefined) return errorResponse(res, 'Harga jual wajib diisi', 400);

      // Cek duplikat
      const existing = db.get(
        `SELECT id FROM produk WHERE tenant_id = ? AND (kode = ? OR barcode = ?) AND deleted = 0`,
        [tenantId, kode, barcode || null]
      );
      if (existing) return errorResponse(res, 'Kode atau barcode sudah digunakan', 409);

      // Fallback aman
      const safe = {
        barcode: barcode ?? null,
        harga_dasar: harga_dasar ?? 0,
        harga_jual: harga_jual,
        berat: berat ?? 0,
        diskon: diskon ?? 0,
        stok_awal: stok_awal ?? 0,
        stok_minimal: stok_minimal ?? 0,
        produk_timbangan: produk_timbangan ? 1 : 0,
        kategori_id: kategori_id ?? null,
        satuan_id: satuan_id ?? null,
        gudang_id: gudang_id ?? null
      };

      db.run(
        `INSERT INTO produk (tenant_id, kode, nama, barcode, harga_dasar, harga_jual, berat, diskon, stok_awal, stok_minimal, produk_timbangan, kategori_id, satuan_id, gudang_id)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          tenantId, kode, nama, safe.barcode,
          safe.harga_dasar, safe.harga_jual, safe.berat, safe.diskon,
          safe.stok_awal, safe.stok_minimal, safe.produk_timbangan,
          safe.kategori_id, safe.satuan_id, safe.gudang_id
        ]
      );

      const idRow = db.get(
        'SELECT id FROM produk WHERE tenant_id = ? AND kode = ? ORDER BY id DESC LIMIT 1',
        [tenantId, kode]
      );
      if (!idRow) return errorResponse(res, 'Gagal membuat produk', 500);
      const produkId = idRow.id;

      // Varian
      if (Array.isArray(varian) && varian.length > 0) {
        for (const v of varian) {
          db.run(
            `INSERT INTO varian_produk (produk_id, nama_varian, barcode, harga_dasar, harga_jual, stok, poin, komisi)
             VALUES (?,?,?,?,?,?,?,?)`,
            [produkId, v.nama_varian, v.barcode ?? null, v.harga_dasar ?? 0, v.harga_jual ?? 0, v.stok ?? 0, v.poin ?? 0, v.komisi ?? 0]
          );
        }
      }

      // Satuan
      if (Array.isArray(satuan) && satuan.length > 0) {
        for (const s of satuan) {
          db.run(
            `INSERT INTO produk_satuan (produk_id, varian_id, satuan_id, barcode, faktor_konversi, harga_jual, is_default)
             VALUES (?, NULL, ?, ?, ?, ?, ?)`,
            [produkId, s.satuan_id, s.barcode ?? null, s.faktor_konversi ?? 1, s.harga_jual ?? null, s.is_default ?? 0]
          );
        }
      }

      const produkFinal = db.get(`SELECT * FROM produk WHERE id = ? AND tenant_id = ? AND deleted = 0`, [produkId, tenantId]);
      produkFinal.varian = db.all(`SELECT * FROM varian_produk WHERE produk_id = ? AND deleted = 0`, [produkId]);
      produkFinal.satuan = db.all(
        `SELECT ps.*, st.nama AS satuan_nama FROM produk_satuan ps JOIN satuan st ON ps.satuan_id = st.id WHERE ps.produk_id = ? AND ps.varian_id IS NULL AND ps.deleted = 0`, [produkId]
      );

      return successResponse(res, produkFinal, 'Produk berhasil dibuat', 201);
    } catch (error) {
      console.error('!!! CREATE PRODUK ERROR !!!', error);
      return errorResponse(res, error.message, 500);
    }
  },

  // =================== UPDATE PRODUK ===================
  update: (req, res) => {
    try {
      const { id } = req.params;
      const tenantId = req.user.tenant_id;
      const produk = db.get(`SELECT * FROM produk WHERE id = ? AND tenant_id = ? AND deleted = 0`, [id, tenantId]);
      if (!produk) return errorResponse(res, 'Produk tidak ditemukan', 404);

      const {
        kode, nama, barcode, harga_dasar, harga_jual,
        berat, diskon, stok_awal, stok_minimal,
        produk_timbangan, kategori_id, satuan_id, gudang_id,
        varian, satuan
      } = req.body;

      // Cek duplikat
      if (kode || barcode) {
        const duplikat = db.get(
          `SELECT id FROM produk WHERE tenant_id = ? AND (kode = ? OR barcode = ?) AND id != ? AND deleted = 0`,
          [tenantId, kode || produk.kode, barcode || produk.barcode, id]
        );
        if (duplikat) return errorResponse(res, 'Kode atau barcode sudah digunakan produk lain', 409);
      }

      db.run(
        `UPDATE produk SET
          kode = ?, nama = ?, barcode = ?,
          harga_dasar = ?, harga_jual = ?,
          berat = ?, diskon = ?, stok_awal = ?, stok_minimal = ?,
          produk_timbangan = ?, kategori_id = ?, satuan_id = ?, gudang_id = ?,
          updated_at = datetime('now','localtime')
         WHERE id = ? AND tenant_id = ?`,
        [
          kode ?? produk.kode, nama ?? produk.nama, barcode ?? produk.barcode,
          harga_dasar ?? produk.harga_dasar, harga_jual ?? produk.harga_jual,
          berat ?? produk.berat, diskon ?? produk.diskon,
          stok_awal ?? produk.stok_awal, stok_minimal ?? produk.stok_minimal,
          produk_timbangan !== undefined ? (produk_timbangan ? 1 : 0) : produk.produk_timbangan,
          kategori_id ?? produk.kategori_id, satuan_id ?? produk.satuan_id, gudang_id ?? produk.gudang_id,
          id, tenantId
        ]
      );

      // Sinkronisasi varian
      if (Array.isArray(varian)) {
        const existingIds = db.all(`SELECT id FROM varian_produk WHERE produk_id = ? AND deleted = 0`, [id]).map(v => v.id);
        const requestIds = varian.filter(v => v.id).map(v => Number(v.id));
        for (const delId of existingIds.filter(eid => !requestIds.includes(eid))) {
          db.run(`UPDATE varian_produk SET deleted = 1 WHERE id = ?`, [delId]);
        }
        for (const v of varian) {
          if (v.id && existingIds.includes(Number(v.id))) {
            db.run(
              `UPDATE varian_produk SET nama_varian=?, barcode=?, harga_dasar=?, harga_jual=?, stok=?, poin=?, komisi=?, updated_at=datetime('now','localtime') WHERE id=? AND produk_id=?`,
              [v.nama_varian, v.barcode??null, v.harga_dasar??0, v.harga_jual??0, v.stok??0, v.poin??0, v.komisi??0, v.id, id]
            );
          } else {
            db.run(
              `INSERT INTO varian_produk (produk_id, nama_varian, barcode, harga_dasar, harga_jual, stok, poin, komisi) VALUES (?,?,?,?,?,?,?,?)`,
              [id, v.nama_varian, v.barcode??null, v.harga_dasar??0, v.harga_jual??0, v.stok??0, v.poin??0, v.komisi??0]
            );
          }
        }
      }

      // Sinkronisasi satuan
      if (Array.isArray(satuan)) {
        const existingSatuan = db.all(`SELECT id FROM produk_satuan WHERE produk_id = ? AND varian_id IS NULL AND deleted = 0`, [id]);
        const existingIds = existingSatuan.map(s => s.id);
        const requestIds = satuan.filter(s => s.id).map(s => Number(s.id));
        for (const delId of existingIds.filter(eid => !requestIds.includes(eid))) {
          db.run(`UPDATE produk_satuan SET deleted = 1 WHERE id = ?`, [delId]);
        }
        for (const s of satuan) {
          if (s.id && existingIds.includes(Number(s.id))) {
            db.run(
              `UPDATE produk_satuan SET satuan_id=?, barcode=?, faktor_konversi=?, harga_jual=?, is_default=?, updated_at=datetime('now','localtime') WHERE id=? AND produk_id=? AND varian_id IS NULL`,
              [s.satuan_id, s.barcode??null, s.faktor_konversi??1, s.harga_jual??null, s.is_default??0, s.id, id]
            );
          } else {
            db.run(
              `INSERT INTO produk_satuan (produk_id, varian_id, satuan_id, barcode, faktor_konversi, harga_jual, is_default) VALUES (?, NULL, ?, ?, ?, ?, ?)`,
              [id, s.satuan_id, s.barcode??null, s.faktor_konversi??1, s.harga_jual??null, s.is_default??0]
            );
          }
        }
      }

      const updatedProduk = db.get(
        `SELECT p.*, k.nama AS kategori_nama, st.nama AS satuan_nama, g.nama AS gudang_nama
         FROM produk p
         LEFT JOIN kategori k ON p.kategori_id = k.id AND k.deleted = 0
         LEFT JOIN satuan st ON p.satuan_id = st.id AND st.deleted = 0
         LEFT JOIN gudang g ON p.gudang_id = g.id AND g.deleted = 0
         WHERE p.id = ? AND p.tenant_id = ? AND p.deleted = 0`, [id, tenantId]
      );
      updatedProduk.varian = db.all(`SELECT * FROM varian_produk WHERE produk_id = ? AND deleted = 0`, [id]);
      updatedProduk.satuan = db.all(
        `SELECT ps.*, st.nama AS satuan_nama FROM produk_satuan ps JOIN satuan st ON ps.satuan_id = st.id WHERE ps.produk_id = ? AND ps.varian_id IS NULL AND ps.deleted = 0`, [id]
      );
      return successResponse(res, updatedProduk, 'Produk berhasil diperbarui');
    } catch (error) {
      return errorResponse(res, error.message, 500);
    }
  },

  // =================== HAPUS PRODUK ===================
  remove: (req, res) => {
    try {
      const { id } = req.params;
      const tenantId = req.user.tenant_id;
      const produk = db.get(`SELECT * FROM produk WHERE id = ? AND tenant_id = ? AND deleted = 0`, [id, tenantId]);
      if (!produk) return errorResponse(res, 'Produk tidak ditemukan', 404);

      db.run(`UPDATE produk SET deleted = 1, updated_at = datetime('now','localtime') WHERE id = ? AND tenant_id = ?`, [id, tenantId]);
      db.run(`UPDATE varian_produk SET deleted = 1, updated_at = datetime('now','localtime') WHERE produk_id = ?`, [id]);
      db.run(`UPDATE produk_satuan SET deleted = 1, updated_at = datetime('now','localtime') WHERE produk_id = ?`, [id]);
      return successResponse(res, { id }, 'Produk berhasil dihapus');
    } catch (error) {
      return errorResponse(res, error.message, 500);
    }
  },

  // =================== VARIAN ===================
  addVarian: (req, res) => {
    try {
      const produkId = parseInt(req.params.id);
      const tenantId = req.user.tenant_id;
      const produk = db.get(`SELECT id FROM produk WHERE id = ? AND tenant_id = ? AND deleted = 0`, [produkId, tenantId]);
      if (!produk) return errorResponse(res, 'Produk tidak ditemukan', 404);

      const { nama_varian, barcode, harga_dasar, harga_jual, stok, poin, komisi } = req.body;
      if (!nama_varian) return errorResponse(res, 'nama_varian wajib diisi', 400);

      db.run(
        `INSERT INTO varian_produk (produk_id, nama_varian, barcode, harga_dasar, harga_jual, stok, poin, komisi)
         VALUES (?,?,?,?,?,?,?,?)`,
        [produkId, nama_varian, barcode ?? null, harga_dasar ?? 0, harga_jual ?? 0, stok ?? 0, poin ?? 0, komisi ?? 0]
      );
      const newId = db.get('SELECT last_insert_rowid() AS id').id;
      const varian = db.get('SELECT * FROM varian_produk WHERE id = ?', [newId]);
      return successResponse(res, varian, 'Varian berhasil ditambahkan', 201);
    } catch (error) {
      return errorResponse(res, error.message, 500);
    }
  },

  getVarian: (req, res) => {
    try {
      const produkId = parseInt(req.params.id);
      const tenantId = req.user.tenant_id;
      // Pastikan produk milik tenant
      const produk = db.get(`SELECT id FROM produk WHERE id = ? AND tenant_id = ? AND deleted = 0`, [produkId, tenantId]);
      if (!produk) return errorResponse(res, 'Produk tidak ditemukan', 404);

      const varian = db.all('SELECT * FROM varian_produk WHERE produk_id = ? AND deleted = 0', [produkId]);
      return successResponse(res, varian, 'Daftar varian');
    } catch (error) {
      return errorResponse(res, error.message, 500);
    }
  },

  // =================== SATUAN ===================
  addSatuan: (req, res) => {
    try {
      const produkId = parseInt(req.params.id);
      const tenantId = req.user.tenant_id;
      const produk = db.get(`SELECT id FROM produk WHERE id = ? AND tenant_id = ? AND deleted = 0`, [produkId, tenantId]);
      if (!produk) return errorResponse(res, 'Produk tidak ditemukan', 404);

      const { satuan_id, barcode, faktor_konversi, harga_jual, is_default, varian_id } = req.body;
      if (!satuan_id) return errorResponse(res, 'satuan_id wajib diisi', 400);

      db.run(
        `INSERT INTO produk_satuan (produk_id, varian_id, satuan_id, barcode, faktor_konversi, harga_jual, is_default)
         VALUES (?,?,?,?,?,?,?)`,
        [produkId, varian_id ?? null, satuan_id, barcode ?? null, faktor_konversi ?? 1, harga_jual ?? null, is_default ?? 0]
      );
      const newId = db.get('SELECT last_insert_rowid() AS id').id;
      const satuan = db.get(
        `SELECT ps.*, st.nama AS satuan_nama FROM produk_satuan ps JOIN satuan st ON ps.satuan_id = st.id WHERE ps.id = ?`, [newId]
      );
      return successResponse(res, satuan, 'Satuan berhasil ditambahkan', 201);
    } catch (error) {
      return errorResponse(res, error.message, 500);
    }
  },

  getSatuan: (req, res) => {
    try {
      const produkId = parseInt(req.params.id);
      const tenantId = req.user.tenant_id;
      const produk = db.get(`SELECT id FROM produk WHERE id = ? AND tenant_id = ? AND deleted = 0`, [produkId, tenantId]);
      if (!produk) return errorResponse(res, 'Produk tidak ditemukan', 404);

      const satuan = db.all(
        `SELECT ps.*, st.nama AS satuan_nama FROM produk_satuan ps JOIN satuan st ON ps.satuan_id = st.id WHERE ps.produk_id = ? AND ps.varian_id IS NULL AND ps.deleted = 0`, [produkId]
      );
      return successResponse(res, satuan, 'Daftar satuan produk');
    } catch (error) {
      return errorResponse(res, error.message, 500);
    }
  },

  // =================== HARGA BERTINGKAT ===================
  addHargaBertingkat: (req, res) => {
    try {
      const produkId = parseInt(req.params.id);
      const tenantId = req.user.tenant_id;
      const produk = db.get(`SELECT id FROM produk WHERE id = ? AND tenant_id = ? AND deleted = 0`, [produkId, tenantId]);
      if (!produk) return errorResponse(res, 'Produk tidak ditemukan', 404);

      const { varian_id, min_qty, max_qty, harga } = req.body;
      if (!min_qty || !harga) return errorResponse(res, 'min_qty dan harga wajib diisi', 400);

      db.run(
        `INSERT INTO harga_bertingkat (produk_id, varian_id, min_qty, max_qty, harga) VALUES (?,?,?,?,?)`,
        [produkId, varian_id ?? null, min_qty, max_qty ?? null, harga]
      );
      return successResponse(res, null, 'Harga bertingkat ditambahkan', 201);
    } catch (error) {
      return errorResponse(res, error.message, 500);
    }
  },

  getHargaBertingkat: (req, res) => {
    try {
      const produkId = parseInt(req.params.id);
      const tenantId = req.user.tenant_id;
      const produk = db.get(`SELECT id FROM produk WHERE id = ? AND tenant_id = ? AND deleted = 0`, [produkId, tenantId]);
      if (!produk) return errorResponse(res, 'Produk tidak ditemukan', 404);

      const data = db.all('SELECT * FROM harga_bertingkat WHERE produk_id = ? AND deleted = 0 ORDER BY min_qty', [produkId]);
      return successResponse(res, data, 'Daftar harga bertingkat');
    } catch (error) {
      return errorResponse(res, error.message, 500);
    }
  }
};

module.exports = produkController;