// routes/inventory.js
const express = require('express');
const router = express.Router();
const inventoryController = require('../controllers/inventoryController');
const { authenticateToken } = require('../middleware/auth');

router.use(authenticateToken);

// Stok masuk & keluar
router.post('/stock-in', inventoryController.stockIn);
router.post('/stock-out', inventoryController.stockOut);

// Transfer
router.post('/transfer', inventoryController.createTransfer);
router.get('/transfer', inventoryController.getTransfer);
router.get('/transfer/:id', inventoryController.getTransferById);   // pastikan ini ada
router.put('/transfer/:id/complete', inventoryController.completeTransfer);
router.put('/transfer/:id/cancel', inventoryController.cancelTransfer);

// Stok Opname
router.post('/opname', inventoryController.createOpname);
router.get('/opname', inventoryController.getOpname);
router.get('/opname/:id', inventoryController.getOpnameById);
router.post('/opname/:id/detail', inventoryController.addOpnameDetail);
router.put('/opname/:id/complete', inventoryController.completeOpname);
router.put('/opname/:id/cancel', inventoryController.cancelOpname);

// Riwayat mutasi
router.get('/mutation', inventoryController.getMutation);

// Stok saat ini
router.get('/stock', inventoryController.getStock);

module.exports = router;