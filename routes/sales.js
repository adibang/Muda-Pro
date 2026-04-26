const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const salesController = require('../controllers/salesController');
const { authenticateToken } = require('../middleware/auth');
const { errorResponse } = require('../utils/response');

const validate = (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return errorResponse(res, 'Validasi gagal', 400, errors.array());
    }
    next();
  } catch (e) {
    console.error('Validation error:', e);
    return errorResponse(res, 'Error validasi internal', 500);
  }
};

const salesValidation = [
  body('items').isArray({ min: 1 }).withMessage('Minimal satu item diperlukan'),
  body('items.*.produk_id')
    .if(body('items.*.barcode_mentah').not().exists())
    .isInt().withMessage('produk_id harus integer'),
  body('items.*.kuantitas')
    .if(body('items.*.barcode_mentah').not().exists())
    .isNumeric().withMessage('kuantitas harus angka'),
  body('dibayar').isNumeric().withMessage('dibayar harus angka'),
];

router.get('/', authenticateToken, salesController.getAll);
router.get('/:id', authenticateToken, salesController.getById);
router.post('/', authenticateToken, salesValidation, validate, salesController.create);

module.exports = router;