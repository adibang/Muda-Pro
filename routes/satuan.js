const express = require('express');
const router = express.Router();
const satuanController = require('../controllers/satuanController');
const { authenticateToken, authorizeRole } = require('../middleware/auth');

router.use(authenticateToken);

router.post('/', authorizeRole('admin'), satuanController.create);
router.get('/', authorizeRole('admin', 'kasir', 'stok'), satuanController.getAll);
router.get('/:id', authorizeRole('admin', 'kasir', 'stok'), satuanController.getById);
router.put('/:id', authorizeRole('admin'), satuanController.update);
router.delete('/:id', authorizeRole('admin'), satuanController.remove);

module.exports = router;