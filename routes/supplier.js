const express = require('express');
const router = express.Router();
const supplierController = require('../controllers/supplierController');
const { authenticateToken, authorizeRole } = require('../middleware/auth');

router.use(authenticateToken);

router.post('/', authorizeRole('admin'), supplierController.create);
router.get('/', authorizeRole('admin', 'stok'), supplierController.getAll);
router.get('/:id', authorizeRole('admin', 'stok'), supplierController.getById);
router.put('/:id', authorizeRole('admin'), supplierController.update);
router.delete('/:id', authorizeRole('admin'), supplierController.remove);

module.exports = router;