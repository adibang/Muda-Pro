const express = require('express');
const { body, param, validationResult } = require('express-validator');
const router = express.Router();
const purchaseController = require('../controllers/purchaseController');
const { authenticateToken, authorizeRole } = require('../middleware/auth');

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ status: 'error', message: 'Validasi gagal', errors: errors.array() });
  }
  next();
};

router.use(authenticateToken);

// Admin only: create & update PO
router.post('/po', authorizeRole('admin'), [
  body('supplier_id').isInt({ gt: 0 }).withMessage('supplier_id tidak valid'),
  body('items').isArray({ min: 1 }).withMessage('Minimal satu item'),
  body('items.*.produk_id').isInt({ gt: 0 }).withMessage('produk_id tidak valid'),
  body('items.*.kuantitas').isFloat({ gt: 0 }).withMessage('kuantitas > 0'),
  body('items.*.harga_beli').isFloat({ gt: 0 }).withMessage('harga_beli > 0'),
], validate, purchaseController.createPO);

router.put('/po/:id/status', authorizeRole('admin'), purchaseController.updatePOStatus);

// Admin + stok: receive goods
router.post('/receive', authorizeRole('admin', 'stok'), [
  body('items').isArray({ min: 1 }),
  body('items.*.produk_id').isInt({ gt: 0 }),
  body('items.*.kuantitas').isFloat({ gt: 0 }),
], validate, purchaseController.receiveGoods);

// Read: admin + stok
router.get('/po', authorizeRole('admin', 'stok'), purchaseController.getAllPO);
router.get('/po/:id', authorizeRole('admin', 'stok'), purchaseController.getPOById);
router.get('/receive', authorizeRole('admin', 'stok'), purchaseController.getAllPenerimaan);
router.get('/receive/:id', authorizeRole('admin', 'stok'), purchaseController.getPenerimaanById);

module.exports = router;