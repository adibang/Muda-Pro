const express = require('express');
const router = express.Router();
const configController = require('../controllers/configController');
const { authenticateToken, authorizeRole } = require('../middleware/auth');

router.use(authenticateToken);

// GET /api/pengaturan/barcode
router.get('/barcode', authorizeRole('admin'), configController.getBarcodeConfig);

// PUT /api/pengaturan/barcode
router.put('/barcode', authorizeRole('admin'), configController.updateBarcodeConfig);

module.exports = router;