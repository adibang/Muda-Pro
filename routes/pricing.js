const express = require('express');
const router = express.Router();
const pricingController = require('../controllers/pricingController');
const { authenticateToken } = require('../middleware/auth');

router.get('/tier', authenticateToken, pricingController.getTierPricing);
router.post('/tier', authenticateToken, pricingController.createTierPricing);
router.delete('/tier/:id', authenticateToken, pricingController.deleteTierPricing);
router.get('/paket', authenticateToken, pricingController.getPaket);
router.post('/paket', authenticateToken, pricingController.createPaket);
router.delete('/paket/:id', authenticateToken, pricingController.deletePaket);

module.exports = router;