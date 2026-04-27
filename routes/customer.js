const express = require('express');
const router = express.Router();
const customerController = require('../controllers/customerController');
const { authenticateToken, authorizeRole } = require('../middleware/auth');

router.use(authenticateToken);

router.post('/', authorizeRole('admin'), customerController.create);
router.get('/', authorizeRole('admin', 'kasir'), customerController.getAll);
router.get('/:id', authorizeRole('admin', 'kasir'), customerController.getById);
router.put('/:id', authorizeRole('admin'), customerController.update);
router.delete('/:id', authorizeRole('admin'), customerController.remove);

module.exports = router;