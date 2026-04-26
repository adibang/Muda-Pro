const express = require('express');
const router = express.Router();
const configController = require('../controllers/configController');
const { authenticateToken } = require('../middleware/auth');

router.get('/barcode', authenticateToken, configController.getBarcodeConfig);
router.put('/barcode', authenticateToken, configController.updateBarcodeConfig);

module.exports = router;