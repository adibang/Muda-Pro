const express = require('express');
const router = express.Router();
const gudangController = require('../controllers/gudangController');
const { authenticateToken, authorizeRole } = require('../middleware/auth');

router.use(authenticateToken);

router.post('/', authorizeRole('admin'), gudangController.create);
router.get('/', authorizeRole('admin', 'kasir', 'stok'), gudangController.getAll);
router.get('/:id', authorizeRole('admin', 'kasir', 'stok'), gudangController.getById);
router.put('/:id', authorizeRole('admin'), gudangController.update);
router.delete('/:id', authorizeRole('admin'), gudangController.remove);

module.exports = router;