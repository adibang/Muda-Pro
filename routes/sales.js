const express = require('express');
const { body, validationResult } = require('express-validator');
const router = express.Router();
const salesController = require('../controllers/salesController');
const { authenticateToken, authorizeRole } = require('../middleware/auth');

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ status: 'error', message: 'Validasi gagal', errors: errors.array() });
  }
  next();
};

router.use(authenticateToken);

router.post('/', authorizeRole('admin', 'kasir'), [
  body('items').isArray({ min: 1 }).withMessage('Minimal satu item'),
  body('items.*.produk_id').isInt({ gt: 0 }).withMessage('produk_id harus integer positif'),
  body('items.*.kuantitas').isFloat({ gt: 0 }).withMessage('kuantitas harus > 0'),
  body('dibayar').isFloat({ min: 0 }).withMessage('dibayar minimal 0'),
], validate, salesController.create);

router.get('/', authorizeRole('admin', 'kasir', 'stok'), salesController.getAll);
router.get('/:id', authorizeRole('admin', 'kasir', 'stok'), salesController.getById);

module.exports = router;