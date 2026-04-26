const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/customerController');
const { authenticateToken } = require('../middleware/auth');
const { body } = require('express-validator');

router.get('/', authenticateToken, ctrl.getAll);
router.get('/:id', authenticateToken, ctrl.getById);
router.post('/', authenticateToken, [
    body('nama').notEmpty().withMessage('Nama customer wajib diisi')
], ctrl.create);
router.put('/:id', authenticateToken, ctrl.update);
router.delete('/:id', authenticateToken, ctrl.remove);

module.exports = router;