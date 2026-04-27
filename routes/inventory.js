const express = require('express');
const router = express.Router();
const inventoryController = require('../controllers/inventoryController');
const { authenticateToken, authorizeRole } = require('../middleware/auth');

router.use(authenticateToken);

// Stock in/out & transfer: admin + stok
router.post('/stock-in', authorizeRole('admin', 'stok'), inventoryController.stockIn);
router.post('/stock-out', authorizeRole('admin', 'stok'), inventoryController.stockOut);
router.post('/transfer', authorizeRole('admin', 'stok'), inventoryController.createTransfer);
router.put('/transfer/:id/complete', authorizeRole('admin', 'stok'), inventoryController.completeTransfer);
router.put('/transfer/:id/cancel', authorizeRole('admin', 'stok'), inventoryController.cancelTransfer);

// Opname: admin + stok
router.post('/opname', authorizeRole('admin', 'stok'), inventoryController.createOpname);
router.post('/opname/:id/detail', authorizeRole('admin', 'stok'), inventoryController.addOpnameDetail);
router.put('/opname/:id/complete', authorizeRole('admin', 'stok'), inventoryController.completeOpname);
router.put('/opname/:id/cancel', authorizeRole('admin', 'stok'), inventoryController.cancelOpname);

// View: semua role
router.get('/transfer', authorizeRole('admin', 'stok', 'kasir'), inventoryController.getTransfer);
router.get('/transfer/:id', authorizeRole('admin', 'stok', 'kasir'), inventoryController.getTransferById);
router.get('/opname', authorizeRole('admin', 'stok', 'kasir'), inventoryController.getOpname);
router.get('/opname/:id', authorizeRole('admin', 'stok', 'kasir'), inventoryController.getOpnameById);
router.get('/mutation', authorizeRole('admin', 'stok', 'kasir'), inventoryController.getMutation);
router.get('/stock', authorizeRole('admin', 'stok', 'kasir'), inventoryController.getStock);

module.exports = router;