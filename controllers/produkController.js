const { db } = require('../config/database');
const { successResponse, errorResponse } = require('../utils/response');

const produkController = {
  // GET /api/produk?search=&kategori_id=&gudang_id=
  getAll: (req, res) => {
    try {
      let sql = `SELECT p.*, k.nama AS kategori_nama, s.nama AS satuan_nama, g.nama AS gudang_nama
                 FROM produk p
                 LEFT JOIN kategori k ON p.kategori_id = k.id AND k.deleted = 0
                 LEFT JOIN satuan s ON p.satuan_id = s.id AND s.deleted = 0
                 LEFT JOIN gudang g ON p.gudang_id = g.id AND g.deleted = 0
                 WHERE p.deleted = 0`;
      const params = [];

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
      return successResponse(res, 'Daftar produk berhasil diambil', produk);
    } catch (error) {
      return errorResponse(res, error.message, 500);
    }
  },

  // GET /api/produk/:id
  getById: (req, res) => {
    try {
      const { id } = req.params;
      const produk = db.get(
        `SELECT p.*, k.nama AS kategori_nama, s.nama AS satuan_nama, g.nama AS gudang_nama
         FROM produk p
         LEFT JOIN kategori k ON p.kategori_id = k.id AND k.deleted = 0
         LEFT JOIN satuan s ON p.satuan_id = s.id AND s.deleted = 0
         LEFT JOIN gudang g ON p.gudang_id = g.id AND g.deleted = 0
         WHERE p.id = ? AND p.deleted = 0`,
        [id]
      );
      if (!produk) {
        return errorResponse(res, 'Produk tidak ditemukan', 404);
      }

      const varian = db.all(
        `SELECT * FROM varian_produk WHERE produk_id = ? AND deleted = 0`,
        [id]
      );
      produk.varian = varian;

      const satuanList = db.all(
        `SELECT ps.*, st.nama AS satuan_nama
         FROM produk_satuan ps
         JOIN satuan st ON ps.satuan_id = st.id AND st.deleted = 0
         WHERE ps.produk_id = ? AND ps.varian_id IS NULL AND ps.deleted = 0`,
        [id]
      );
      produk.satuan = satuanList;

      // Untuk setiap varian, ambil satuannya juga
      for (const v of produk.varian) {
        v.satuan = db.all(
          `SELECT ps.*, st.nama AS satuan_nama
           FROM produk_satuan ps
           JOIN satuan st ON ps.satuan_id = st.id AND st.deleted = 0
           WHERE ps.varian_id = ? AND ps.deleted = 0`,
          [v.id]
        );
      }

      return successResponse(res, 'Detail produk berhasil diambil', produk);
    } catch (error) {
      return errorResponse(res, error.message, 500);
    }
  },

  // POST /api/produk
    create: (req, res) => {
    try {
      const {
        kode, nama, barcode, harga_dasar, harga_jual,
        berat, diskon, stok_awal, stok_minimal,
        produk_timbangan, kategori_id, satuan_id, gudang_id,
        varian, satuan
      } = req.body;

      // Validasi duplikat
      const existing = db.get(
        `SELECT id FROM produk WHERE (kode = ? OR barcode = ?) AND deleted = 0`,
        [kode, barcode]
      );
      if (existing) {
        return errorResponse(res, 'Kode atau barcode sudah digunakan', 409);
      }

      // Insert produk
      db.run(
        `INSERT INTO produk (kode, nama, barcode, harga_dasar, harga_jual, berat, diskon, stok_awal, stok_minimal, produk_timbangan, kategori_id, satuan_id, gudang_id)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          kode, nama, barcode || null, harga_dasar, harga_jual,
          berat || 0, diskon || 0, stok_awal || 0, stok_minimal || 0,
          produk_timbangan ? 1 : 0, kategori_id || null, satuan_id || null, gudang_id || null
        ]
      );

      // Ambil ID produk yang baru dibuat
      const idRow = db.get('SELECT id FROM produk WHERE kode = ? ORDER BY id DESC LIMIT 1', [kode]);
      if (!idRow) {
        return errorResponse(res, 'Gagal mendapatkan ID produk baru', 500);
      }
      const produkId = idRow.id;

      // Insert varian jika ada
      if (Array.isArray(varian) && varian.length > 0) {
        for (const v of varian) {
          db.run(
            `INSERT INTO varian_produk (produk_id, nama_varian, barcode, harga_dasar, harga_jual, stok, poin, komisi)
             VALUES (?,?,?,?,?,?,?,?)`,
            [
              produkId,
              v.nama_varian,
              v.barcode || null,
              v.harga_dasar || 0,
              v.harga_jual || 0,
              v.stok || 0,
              v.poin || 0,
              v.komisi || 0
            ]
          );
        }
      }

      // Insert satuan untuk produk (jika ada)
      if (Array.isArray(satuan) && satuan.length > 0) {
        for (const s of satuan) {
          db.run(
            `INSERT INTO produk_satuan (produk_id, varian_id, satuan_id, barcode, faktor_konversi, harga_jual, is_default)
             VALUES (?, NULL, ?, ?, ?, ?, ?)`,
            [
              produkId,
              s.satuan_id,
              s.barcode || null,
              s.faktor_konversi || 1,
              s.harga_jual || null,
              s.is_default || 0
            ]
          );
        }
      }

      // Ambil data lengkap produk
      const produkFinal = db.get(`SELECT * FROM produk WHERE id = ? AND deleted = 0`, [produkId]);
      const varianBaru = db.all(`SELECT * FROM varian_produk WHERE produk_id = ? AND deleted = 0`, [produkId]);
      produkFinal.varian = varianBaru;
      produkFinal.satuan = db.all(
        `SELECT ps.*, st.nama AS satuan_nama FROM produk_satuan ps JOIN satuan st ON ps.satuan_id = st.id WHERE ps.produk_id = ? AND ps.varian_id IS NULL AND ps.deleted = 0`,
        [produkId]
      );

      return successResponse(res, 'Produk berhasil dibuat', produkFinal, 201);
    } catch (error) {
      console.error('!!! CREATE PRODUK ERROR !!!', error);
      console.error('Stack:', error.stack);
      return errorResponse(res, error.message, 500);
    }
  },

  // PUT /api/produk/:id
  update: (req, res) => {
    try {
      const { id } = req.params;
      const produk = db.get(`SELECT * FROM produk WHERE id = ? AND deleted = 0`, [id]);
      if (!produk) {
        return errorResponse(res, 'Produk tidak ditemukan', 404);
      }

      const {
        kode, nama, barcode, harga_dasar, harga_jual,
        berat, diskon, stok_awal, stok_minimal,
        produk_timbangan, kategori_id, satuan_id, gudang_id,
        varian, satuan
      } = req.body;

      if (kode || barcode) {
        const duplikat = db.get(
          `SELECT id FROM produk WHERE (kode = ? OR barcode = ?) AND id != ? AND deleted = 0`,
          [kode || produk.kode, barcode || produk.barcode, id]
        );
        if (duplikat) {
          return errorResponse(res, 'Kode atau barcode sudah digunakan produk lain', 409);
        }
      }

      db.run(
        `UPDATE produk SET
          kode = ?, nama = ?, barcode = ?,
          harga_dasar = ?, harga_jual = ?,
          berat = ?, diskon = ?, stok_awal = ?, stok_minimal = ?,
          produk_timbangan = ?, kategori_id = ?, satuan_id = ?, gudang_id = ?,
          updated_at = datetime('now','localtime')
         WHERE id = ?`,
        [
          kode ?? produk.kode,
          nama ?? produk.nama,
          barcode ?? produk.barcode,
          harga_dasar ?? produk.harga_dasar,
          harga_jual ?? produk.harga_jual,
          berat ?? produk.berat,
          diskon ?? produk.diskon,
          stok_awal ?? produk.stok_awal,
          stok_minimal ?? produk.stok_minimal,
          produk_timbangan !== undefined ? (produk_timbangan ? 1 : 0) : produk.produk_timbangan,
          kategori_id ?? produk.kategori_id,
          satuan_id ?? produk.satuan_id,
          gudang_id ?? produk.gudang_id,
          id
        ]
      );

      // Sinkronisasi varian
      if (Array.isArray(varian)) {
        const existingIds = db.all(`SELECT id FROM varian_produk WHERE produk_id = ? AND deleted = 0`, [id]).map(v => v.id);
        const requestIds = varian.filter(v => v.id).map(v => Number(v.id));
        const toDelete = existingIds.filter(eid => !requestIds.includes(eid));
        for (const delId of toDelete) {
          db.run(`UPDATE varian_produk SET deleted = 1, updated_at = datetime('now','localtime') WHERE id = ?`, [delId]);
        }
        for (const v of varian) {
          if (v.id && existingIds.includes(Number(v.id))) {
            db.run(
              `UPDATE varian_produk SET nama_varian=?, barcode=?, harga_dasar=?, harga_jual=?, stok=?, poin=?, komisi=?, updated_at=datetime('now','localtime') WHERE id=? AND produk_id=?`,
              [v.nama_varian, v.barcode||null, v.harga_dasar??0, v.harga_jual??0, v.stok??0, v.poin??0, v.komisi??0, v.id, id]
            );
          } else {
            db.run(
              `INSERT INTO varian_produk (produk_id, nama_varian, barcode, harga_dasar, harga_jual, stok, poin, komisi) VALUES (?,?,?,?,?,?,?,?)`,
              [id, v.nama_varian, v.barcode||null, v.harga_dasar||0, v.harga_jual||0, v.stok||0, v.poin||0, v.komisi||0]
            );
          }
        }
      }

      // Sinkronisasi satuan produk (varian_id = NULL)
      if (Array.isArray(satuan)) {
        const existingSatuan = db.all(`SELECT id FROM produk_satuan WHERE produk_id = ? AND varian_id IS NULL AND deleted = 0`, [id]);
        const existingIds = existingSatuan.map(s => s.id);
        const requestIds = satuan.filter(s => s.id).map(s => Number(s.id));
        const toDelete = existingIds.filter(eid => !requestIds.includes(eid));
        for (const delId of toDelete) {
          db.run(`UPDATE produk_satuan SET deleted = 1, updated_at = datetime('now','localtime') WHERE id = ?`, [delId]);
        }
        for (const s of satuan) {
          if (s.id && existingIds.includes(Number(s.id))) {
            db.run(
              `UPDATE produk_satuan SET satuan_id=?, barcode=?, faktor_konversi=?, harga_jual=?, is_default=?, updated_at=datetime('now','localtime') WHERE id=? AND produk_id=? AND varian_id IS NULL`,
              [s.satuan_id, s.barcode||null, s.faktor_konversi||1, s.harga_jual||null, s.is_default||0, s.id, id]
            );
          } else {
            db.run(
              `INSERT INTO produk_satuan (produk_id, varian_id, satuan_id, barcode, faktor_konversi, harga_jual, is_default)
               VALUES (?, NULL, ?, ?, ?, ?, ?)`,
              [id, s.satuan_id, s.barcode||null, s.faktor_konversi||1, s.harga_jual||null, s.is_default||0]
            );
          }
        }
      }

      // Ambil data terbaru
      const updatedProduk = db.get(
        `SELECT p.*, k.nama AS kategori_nama, st.nama AS satuan_nama, g.nama AS gudang_nama
         FROM produk p
         LEFT JOIN kategori k ON p.kategori_id = k.id AND k.deleted = 0
         LEFT JOIN satuan st ON p.satuan_id = st.id AND st.deleted = 0
         LEFT JOIN gudang g ON p.gudang_id = g.id AND g.deleted = 0
         WHERE p.id = ? AND p.deleted = 0`,
        [id]
      );
      updatedProduk.varian = db.all(`SELECT * FROM varian_produk WHERE produk_id = ? AND deleted = 0`, [id]);
      updatedProduk.satuan = db.all(
        `SELECT ps.*, st.nama AS satuan_nama FROM produk_satuan ps JOIN satuan st ON ps.satuan_id = st.id WHERE ps.produk_id = ? AND ps.varian_id IS NULL AND ps.deleted = 0`,
        [id]
      );
      return successResponse(res, 'Produk berhasil diperbarui', updatedProduk);
    } catch (error) {
      return errorResponse(res, error.message, 500);
    }
  },

  // DELETE /api/produk/:id
  remove: (req, res) => {
    try {
      const { id } = req.params;
      const produk = db.get(`SELECT * FROM produk WHERE id = ? AND deleted = 0`, [id]);
      if (!produk) {
        return errorResponse(res, 'Produk tidak ditemukan', 404);
      }
      db.run(`UPDATE produk SET deleted = 1, updated_at = datetime('now','localtime') WHERE id = ?`, [id]);
      db.run(`UPDATE varian_produk SET deleted = 1, updated_at = datetime('now','localtime') WHERE produk_id = ?`, [id]);
      db.run(`UPDATE produk_satuan SET deleted = 1, updated_at = datetime('now','localtime') WHERE produk_id = ?`, [id]);
      return successResponse(res, 'Produk berhasil dihapus', { id });
    } catch (error) {
      return errorResponse(res, error.message, 500);
    }
  }
};

module.exports = produkController;