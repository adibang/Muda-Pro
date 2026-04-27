const express = require('express');
const router = express.Router();
const pricingController = require('../controllers/pricingController');
const { authenticateToken, authorizeRole } = require('../middleware/auth');

router.use(authenticateToken);

// Harga bertingkat
router.get('/tier', authorizeRole('admin', 'kasir', 'stok'), pricingController.getTierPricing);
router.post('/tier', authorizeRole('admin'), pricingController.createTierPricing);
router.delete('/tier/:id', authorizeRole('admin'), pricingController.deleteTierPricing);

// Paket
router.get('/paket', authorizeRole('admin', 'kasir', 'stok'), pricingController.getPaket);
router.post('/paket', authorizeRole('admin'), pricingController.createPaket);
router.delete('/paket/:id', authorizeRole('admin'), pricingController.deletePaket);

module.exports = router;