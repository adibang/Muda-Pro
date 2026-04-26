const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const produkController = require('../controllers/produkController');
const { authenticateToken } = require('../middleware/auth');
const { errorResponse } = require('../utils/response');

// Middleware cek validasi
const validate = (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return errorResponse(res, 'Validasi gagal', 400, errors.array());
    }
    next();
  } catch (e) {
    console.error('!!! VALIDATION MIDDLEWARE ERROR !!!', e);
    return errorResponse(res, 'Error validasi internal', 500);
  }
};

// Validator untuk produk (termasuk varian & satuan)
const produkValidation = [
  body('kode').notEmpty().withMessage('Kode wajib diisi'),
  body('nama').notEmpty().withMessage('Nama wajib diisi'),
  body('harga_dasar').isNumeric().withMessage('Harga dasar harus angka'),
  body('harga_jual').isNumeric().withMessage('Harga jual harus angka'),
  body('kategori_id').optional({ nullable: true }).isInt(),
  body('satuan_id').optional({ nullable: true }).isInt(),
  body('gudang_id').optional({ nullable: true }).isInt(),
  body('varian').optional().isArray(),
  body('varian.*.nama_varian').notEmpty().withMessage('Nama varian wajib diisi'),
  body('varian.*.harga_jual').optional().isNumeric(),
  body('varian.*.stok').optional().isNumeric(),
  // Validasi untuk array satuan
  body('satuan').optional().isArray(),
  body('satuan.*.satuan_id').isInt().withMessage('satuan_id harus integer'),
  body('satuan.*.faktor_konversi').optional().isNumeric(),
  body('satuan.*.harga_jual').optional({ nullable: true }).isNumeric(),
  body('satuan.*.is_default').optional().isBoolean()
];

router.get('/', authenticateToken, produkController.getAll);
router.get('/:id', authenticateToken, produkController.getById);
router.post('/', authenticateToken, produkValidation, validate, produkController.create);
router.put('/:id', authenticateToken, produkValidation, validate, produkController.update);
router.delete('/:id', authenticateToken, produkController.remove);

module.exports = router;