const express = require('express');
const { body, validationResult } = require('express-validator');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticateToken, authorizeRole } = require('../middleware/auth');

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ status: 'error', message: 'Validasi gagal', errors: errors.array() });
  }
  next();
};

router.post('/register', [
  body('email').isEmail().withMessage('Email tidak valid'),
  body('password').isLength({ min: 8 }).withMessage('Password minimal 8 karakter'),
  body('nama_lengkap').optional().isString(),
  body('nama_toko').notEmpty().withMessage('Nama toko wajib diisi')
], validate, authController.register);

router.post('/login', authController.login);
router.post('/refresh-token', authController.refreshToken);
router.post('/logout', authenticateToken, authController.logout);
router.get('/profile', authenticateToken, authController.profile);

// User management (admin only)
router.post('/users', authenticateToken, authorizeRole('admin'), authController.addUser);
router.get('/users', authenticateToken, authorizeRole('admin'), authController.listUsers);

module.exports = router;