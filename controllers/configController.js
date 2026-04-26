const { db } = require('../config/database');
const { successResponse, errorResponse } = require('../utils/response');

const configController = {
  // GET /api/pengaturan/barcode
  getBarcodeConfig: (req, res) => {
    try {
      const rows = db.all("SELECT kunci, nilai FROM pengaturan WHERE kunci LIKE 'barcode_%'");
      const config = {};
      for (const row of rows) {
        config[row.kunci] = row.nilai;
      }
      return successResponse(res, 'Konfigurasi barcode berhasil diambil', config);
    } catch (error) {
      return errorResponse(res, error.message, 500);
    }
  },

  // PUT /api/pengaturan/barcode
  updateBarcodeConfig: (req, res) => {
    try {
      const allowedKeys = ['barcode_prefix', 'barcode_plu_length', 'barcode_weight_length', 'barcode_weight_scale'];
      const updates = req.body;

      for (const key of Object.keys(updates)) {
        if (!allowedKeys.includes(key)) {
          return errorResponse(res, `Kunci pengaturan '${key}' tidak valid`, 400);
        }
        // Konversi nilai menjadi string
        const value = String(updates[key]);
        db.run(
          `INSERT INTO pengaturan (kunci, nilai, updated_at) VALUES (?, ?, datetime('now','localtime'))
           ON CONFLICT(kunci) DO UPDATE SET nilai = excluded.nilai, updated_at = datetime('now','localtime')`,
          [key, value]
        );
      }

      return successResponse(res, 'Konfigurasi barcode berhasil diperbarui');
    } catch (error) {
      return errorResponse(res, error.message, 500);
    }
  }
};

module.exports = configController;