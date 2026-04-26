const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/authController');
const { authenticateToken } = require('../middleware/auth');
const { body } = require('express-validator');

// Register
router.post('/register', [
    body('email').isEmail().withMessage('Email tidak valid'),
    body('password').isLength({ min: 8 }).withMessage('Password minimal 8 karakter')
], ctrl.register);

// Login
router.post('/login', [
    body('email').isEmail().withMessage('Email tidak valid'),
    body('password').notEmpty().withMessage('Password wajib diisi')
], ctrl.login);

// Refresh token
router.post('/refresh-token', ctrl.refreshToken);

// Logout
router.post('/logout', authenticateToken, ctrl.logout);

// Profile
router.get('/profile', authenticateToken, ctrl.profile);

module.exports = router;