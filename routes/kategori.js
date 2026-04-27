const express = require('express');
const router = express.Router();
const kategoriController = require('../controllers/kategoriController');
const { authenticateToken, authorizeRole } = require('../middleware/auth');

router.use(authenticateToken);

router.post('/', authorizeRole('admin'), kategoriController.create);
router.get('/', authorizeRole('admin', 'kasir', 'stok'), kategoriController.getAll);
router.get('/:id', authorizeRole('admin', 'kasir', 'stok'), kategoriController.getById);
router.put('/:id', authorizeRole('admin'), kategoriController.update);
router.delete('/:id', authorizeRole('admin'), kategoriController.remove);

module.exports = router;