const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const { db } = require('../config/database');
const { successResponse, errorResponse } = require('../utils/response');

const SALT_ROUNDS = parseInt(process.env.SALT_ROUNDS) || 12;
const JWT_SECRET = process.env.JWT_SECRET;
const ACCESS_TOKEN_EXPIRY = process.env.ACCESS_TOKEN_EXPIRY || '15m';
const REFRESH_TOKEN_EXPIRY_DAYS = 7;

// Generate Access Token
const generateAccessToken = (user) => {
    return jwt.sign(
        { id: user.id, email: user.email, role: user.role },
        JWT_SECRET,
        { expiresIn: ACCESS_TOKEN_EXPIRY }
    );
};

// Generate Refresh Token dan simpan ke database
const generateRefreshToken = async (userId) => {
    const token = crypto.randomBytes(64).toString('hex');
    const family = uuidv4();
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000).toISOString();
    
    db.run('INSERT INTO refresh_tokens (user_id, token, family, expires_at) VALUES (?, ?, ?, ?)', 
        [userId, token, family, expiresAt]);
    
    return { token, family };
};

// Register
const register = async (req, res) => {
    const { email, password, nama_lengkap, role } = req.body;
    
    if (!email || !password) {
        return errorResponse(res, 'Email dan password wajib diisi');
    }
    
    if (password.length < 8) {
        return errorResponse(res, 'Password minimal 8 karakter');
    }

    try {
        // Cek apakah email sudah terdaftar
        const existing = db.get('SELECT id FROM users WHERE email = ?', [email]);
        if (existing) {
            return errorResponse(res, 'Email sudah terdaftar', 409);
        }

        const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
        
        db.run('INSERT INTO users (email, password, nama_lengkap, role) VALUES (?, ?, ?, ?)', 
            [email, hashedPassword, nama_lengkap || null, role || 'kasir']);
        
        // Perbaikan: ambil user terakhir yang baru dibuat
        const user = db.get('SELECT id, email, role FROM users ORDER BY id DESC LIMIT 1');
        
        const accessToken = generateAccessToken(user);
        const { token: refreshToken } = await generateRefreshToken(user.id);

        return successResponse(res, {
            accessToken,
            refreshToken,
            user: { id: user.id, email: user.email, role: user.role }
        }, 'Registrasi berhasil', 201);
    } catch (err) {
        console.error(err);
        return errorResponse(res, 'Server error', 500);
    }
};

// Login
const login = async (req, res) => {
    const { email, password } = req.body;
    
    if (!email || !password) {
        return errorResponse(res, 'Email dan password wajib diisi');
    }

    try {
        const user = db.get('SELECT * FROM users WHERE email = ?', [email]);
        if (!user) {
            // Lakukan hash dummy untuk mencegah timing attack
            await bcrypt.compare(password, '$2a$12$dummyhashdummyhashdummyhashdummyhashdummyhash');
            return errorResponse(res, 'Email atau password salah', 401);
        }

        // Cek apakah akun terkunci
        if (user.locked_until && new Date(user.locked_until) > new Date()) {
            return errorResponse(res, 'Akun terkunci. Coba lagi nanti.', 423);
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            // Tambah failed attempts
            const newAttempts = (user.failed_attempts || 0) + 1;
            db.run('UPDATE users SET failed_attempts = ? WHERE id = ?', [newAttempts, user.id]);
            
            // Kunci akun jika 5 kali gagal
            if (newAttempts >= 5) {
                const lockTime = new Date(Date.now() + 15 * 60000).toISOString();
                db.run('UPDATE users SET locked_until = ? WHERE id = ?', [lockTime, user.id]);
            }
            
            return errorResponse(res, 'Email atau password salah', 401);
        }

        // Reset failed attempts
        db.run('UPDATE users SET failed_attempts = 0, locked_until = NULL WHERE id = ?', [user.id]);

        const accessToken = generateAccessToken(user);
        const { token: refreshToken } = await generateRefreshToken(user.id);

        return successResponse(res, {
            accessToken,
            refreshToken,
            user: { id: user.id, email: user.email, role: user.role, nama_lengkap: user.nama_lengkap }
        }, 'Login berhasil');
    } catch (err) {
        console.error(err);
        return errorResponse(res, 'Server error', 500);
    }
};

// Refresh token
const refreshToken = async (req, res) => {
    const { refreshToken: token } = req.body;
    
    if (!token) {
        return errorResponse(res, 'Refresh token diperlukan');
    }

    try {
        const tokenData = db.get('SELECT * FROM refresh_tokens WHERE token = ?', [token]);
        if (!tokenData) {
            return errorResponse(res, 'Token tidak valid', 401);
        }

        // Cek apakah sudah direvoke
        if (tokenData.revoked) {
            // Token reuse attack: revoke semua token di family ini
            db.run('UPDATE refresh_tokens SET revoked = 1 WHERE family = ?', [tokenData.family]);
            return errorResponse(res, 'Token tidak valid', 401);
        }

        // Cek expired
        if (new Date(tokenData.expires_at) < new Date()) {
            return errorResponse(res, 'Token expired', 401);
        }

        // Revoke token lama
        db.run('UPDATE refresh_tokens SET revoked = 1 WHERE id = ?', [tokenData.id]);

        // Generate token baru dalam family yang sama
        const newToken = crypto.randomBytes(64).toString('hex');
        const newExpiry = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000).toISOString();
        db.run('INSERT INTO refresh_tokens (user_id, token, family, expires_at) VALUES (?, ?, ?, ?)', 
            [tokenData.user_id, newToken, tokenData.family, newExpiry]);

        // Generate access token baru
        const user = db.get('SELECT id, email, role FROM users WHERE id = ?', [tokenData.user_id]);
        const accessToken = generateAccessToken(user);

        return successResponse(res, {
            accessToken,
            refreshToken: newToken
        }, 'Token berhasil diperbarui');
    } catch (err) {
        console.error(err);
        return errorResponse(res, 'Server error', 500);
    }
};

// Logout
const logout = async (req, res) => {
    const { refreshToken: token } = req.body;
    
    if (token) {
        try {
            const tokenData = db.get('SELECT family FROM refresh_tokens WHERE token = ?', [token]);
            if (tokenData) {
                db.run('UPDATE refresh_tokens SET revoked = 1 WHERE family = ?', [tokenData.family]);
            }
        } catch (err) {
            console.error(err);
        }
    }
    
    return successResponse(res, null, 'Logout berhasil');
};

// Get current user profile
const profile = async (req, res) => {
    try {
        const user = db.get('SELECT id, email, role, nama_lengkap, created_at FROM users WHERE id = ?', [req.user.id]);
        if (!user) {
            return errorResponse(res, 'User tidak ditemukan', 404);
        }
        return successResponse(res, user, 'Profil berhasil diambil');
    } catch (err) {
        console.error(err);
        return errorResponse(res, 'Server error', 500);
    }
};

module.exports = { register, login, refreshToken, logout, profile };