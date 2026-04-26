const { db } = require('../config/database');
const { successResponse, errorResponse } = require('../utils/response');

const pricingController = {
  // ===== HARGA BERTINGKAT =====
  getTierPricing: (req, res) => {
    try {
      const { produk_id } = req.query;
      let sql = `SELECT * FROM harga_bertingkat WHERE deleted = 0`;
      const params = [];
      if (produk_id) { sql += ` AND produk_id = ?`; params.push(produk_id); }
      sql += ` ORDER BY min_qty ASC`;
      const data = db.all(sql, params);
      return successResponse(res, 'Data harga bertingkat', data);
    } catch (e) {
      return errorResponse(res, e.message, 500);
    }
  },

  createTierPricing: (req, res) => {
    try {
      const { produk_id, varian_id, min_qty, max_qty, harga } = req.body;
      db.run(`INSERT INTO harga_bertingkat (produk_id, varian_id, min_qty, max_qty, harga)
              VALUES (?,?,?,?,?)`,
        [produk_id, varian_id || null, min_qty, max_qty || null, harga]);
      const newId = db.get('SELECT last_insert_rowid() AS id').id;
      const row = db.get('SELECT * FROM harga_bertingkat WHERE id = ?', [newId]);
      return successResponse(res, 'Harga bertingkat dibuat', row, 201);
    } catch (e) {
      return errorResponse(res, e.message, 500);
    }
  },

  deleteTierPricing: (req, res) => {
    try {
      const { id } = req.params;
      db.run(`UPDATE harga_bertingkat SET deleted = 1 WHERE id = ?`, [id]);
      return successResponse(res, 'Harga bertingkat dihapus');
    } catch (e) {
      return errorResponse(res, e.message, 500);
    }
  },

  // ===== PAKET =====
  getPaket: (req, res) => {
    try {
      const pakets = db.all(`SELECT * FROM paket WHERE deleted = 0`);
      for (const p of pakets) {
        p.items = db.all(`SELECT * FROM paket_item WHERE paket_id = ?`, [p.id]);
      }
      return successResponse(res, 'Daftar paket', pakets);
    } catch (e) {
      return errorResponse(res, e.message, 500);
    }
  },

    createPaket: (req, res) => {
    try {
      const { nama, tipe = 'single', produk_id, varian_id, harga_paket, items } = req.body;
      if (tipe === 'bundle' && (!Array.isArray(items) || items.length === 0)) {
        return errorResponse(res, 'Item bundel harus diisi', 400);
      }

      db.run(`INSERT INTO paket (nama, tipe, produk_id, varian_id, harga_paket)
              VALUES (?,?,?,?,?)`,
        [nama, tipe, produk_id || null, varian_id || null, harga_paket]);

      // Ambil ID terbaru (karena autoincrement)
      const idRow = db.get('SELECT MAX(id) AS id FROM paket');
      if (!idRow || !idRow.id) {
        return errorResponse(res, 'Gagal membuat paket', 500);
      }
      const paketId = idRow.id;

      if (tipe === 'bundle') {
        for (const it of items) {
          db.run(`INSERT INTO paket_item (paket_id, produk_id, varian_id, kuantitas)
                  VALUES (?,?,?,?)`,
            [paketId, it.produk_id, it.varian_id || null, it.kuantitas]);
        }
      } else {
        // single: simpan item dengan kuantitas dari items[0].kuantitas (default 1 jika tidak ada)
        const qty = (items && items.length > 0 && items[0].kuantitas) ? items[0].kuantitas : 1;
        db.run(`INSERT INTO paket_item (paket_id, produk_id, varian_id, kuantitas)
                VALUES (?,?,?,?)`,
          [paketId, produk_id, varian_id || null, qty]);
      }

      const paket = db.get(`SELECT * FROM paket WHERE id = ?`, [paketId]);
      if (!paket) {
        return errorResponse(res, 'Gagal mengambil data paket', 500);
      }
      paket.items = db.all(`SELECT * FROM paket_item WHERE paket_id = ?`, [paketId]);
      return successResponse(res, 'Paket berhasil dibuat', paket, 201);
    } catch (e) {
      return errorResponse(res, e.message, 500);
    }
  },

  deletePaket: (req, res) => {
    try {
      const { id } = req.params;
      db.run(`UPDATE paket SET deleted = 1 WHERE id = ?`, [id]);
      return successResponse(res, 'Paket dihapus');
    } catch (e) {
      return errorResponse(res, e.message, 500);
    }
  }
};

module.exports = pricingController;