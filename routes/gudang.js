const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/gudangController');
const { authenticateToken } = require('../middleware/auth');
const { body } = require('express-validator');

router.get('/', authenticateToken, ctrl.getAll);
router.get('/:id', authenticateToken, ctrl.getById);
router.post('/', authenticateToken, [
    body('kode').notEmpty().withMessage('Kode gudang wajib diisi'),
    body('nama').notEmpty().withMessage('Nama gudang wajib diisi')
], ctrl.create);
router.put('/:id', authenticateToken, ctrl.update);
router.delete('/:id', authenticateToken, ctrl.remove);

module.exports = router;