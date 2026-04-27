const express = require('express');
const router = express.Router();
const produkController = require('../controllers/produkController');
const { authenticateToken, authorizeRole } = require('../middleware/auth');

router.use(authenticateToken);

// Admin only: create, update, delete
router.post('/', authorizeRole('admin'), produkController.create);
router.put('/:id', authorizeRole('admin'), produkController.update);
router.delete('/:id', authorizeRole('admin'), produkController.remove);

// Admin, kasir, stok: read
router.get('/', authorizeRole('admin', 'kasir', 'stok'), produkController.getAll);
router.get('/:id', authorizeRole('admin', 'kasir', 'stok'), produkController.getById);

// Varian & satuan: admin only untuk modifikasi, stok bisa lihat
router.post('/:id/varian', authorizeRole('admin'), produkController.addVarian);
router.get('/:id/varian', authorizeRole('admin', 'stok'), produkController.getVarian);
router.post('/:id/satuan', authorizeRole('admin'), produkController.addSatuan);
router.get('/:id/satuan', authorizeRole('admin', 'stok'), produkController.getSatuan);

// Harga bertingkat: admin only
router.post('/:id/harga-bertingkat', authorizeRole('admin'), produkController.addHargaBertingkat);
router.get('/:id/harga-bertingkat', authorizeRole('admin'), produkController.getHargaBertingkat);

module.exports = router;