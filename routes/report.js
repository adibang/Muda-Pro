const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const { authenticateToken, authorizeRole } = require('../middleware/auth');

router.use(authenticateToken);

// Semua laporan hanya untuk admin
router.get('/sales', authorizeRole('admin'), reportController.salesReport);
router.get('/profit-loss', authorizeRole('admin'), reportController.profitLossReport);
router.get('/stock', authorizeRole('admin'), reportController.stockReport);
router.get('/purchase', authorizeRole('admin'), reportController.purchaseReport);
router.get('/mutation', authorizeRole('admin'), reportController.mutationReport);

module.exports = router;