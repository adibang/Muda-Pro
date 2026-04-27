const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const { db } = require('../config/database');
const { successResponse, errorResponse } = require('../utils/response');

const SALT_ROUNDS = parseInt(process.env.SALT_ROUNDS) || 12;
const JWT_SECRET = process.env.JWT_SECRET;
const ACCESS_TOKEN_EXPIRY = process.env.ACCESS_TOKEN_EXPIRY || '8h';
const REFRESH_TOKEN_EXPIRY_DAYS = 7;

// Generate Access Token (termasuk tenant_id)
const generateAccessToken = (user) => {
    return jwt.sign(
        { id: user.id, email: user.email, role: user.role, tenant_id: user.tenant_id },
        JWT_SECRET,
        { expiresIn: ACCESS_TOKEN_EXPIRY }
    );
};

// Generate Refresh Token
const generateRefreshToken = async (userId) => {
    const token = crypto.randomBytes(64).toString('hex');
    const family = uuidv4();
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000).toISOString();
    
    db.run('INSERT INTO refresh_tokens (user_id, token, family, expires_at) VALUES (?, ?, ?, ?)', 
        [userId, token, family, expiresAt]);
    
    return { token, family };
};

// Seed data default untuk tenant baru
function seedTenantData(tenantId) {
    db.run('INSERT INTO gudang (tenant_id, kode, nama) VALUES (?, ?, ?)', [tenantId, 'GDG-01', 'Gudang Utama']);
    db.run('INSERT INTO satuan (tenant_id, nama) VALUES (?, ?)', [tenantId, 'Pcs']);
    db.run('INSERT INTO satuan (tenant_id, nama) VALUES (?, ?)', [tenantId, 'Kg']);
    db.run('INSERT INTO satuan (tenant_id, nama) VALUES (?, ?)', [tenantId, 'Liter']);
    db.run('INSERT INTO kategori (tenant_id, nama) VALUES (?, ?)', [tenantId, 'Umum']);

    const akunList = [
        ['101', 'Kas', 'aset', 'debit'],
        ['102', 'Piutang Usaha', 'aset', 'debit'],
        ['103', 'Persediaan Barang', 'aset', 'debit'],
        ['201', 'Hutang Usaha', 'kewajiban', 'kredit'],
        ['301', 'Modal', 'ekuitas', 'kredit'],
        ['401', 'Penjualan', 'pendapatan', 'kredit'],
        ['501', 'HPP', 'beban', 'debit'],
        ['601', 'Diskon Penjualan', 'beban', 'debit'],
        ['701', 'Beban Operasional', 'beban', 'debit']
    ];
    akunList.forEach(a => {
        db.run('INSERT OR IGNORE INTO akun (kode, nama, tipe, saldo_normal) VALUES (?, ?, ?, ?)', [a[0], a[1], a[2], a[3]]);
    });
}

// Register (membuat tenant baru + user admin)
const register = async (req, res) => {
    const { email, password, nama_lengkap, nama_toko } = req.body;
    
    if (!email || !password) {
        return errorResponse(res, 'Email dan password wajib diisi');
    }
    if (password.length < 8) {
        return errorResponse(res, 'Password minimal 8 karakter');
    }
    if (!nama_toko || nama_toko.trim() === '') {
        return errorResponse(res, 'Nama toko wajib diisi', 400);
    }

    try {
        const existing = db.get('SELECT id FROM users WHERE email = ?', [email]);
        if (existing) {
            return errorResponse(res, 'Email sudah terdaftar', 409);
        }

        db.run('INSERT INTO tenants (nama_toko) VALUES (?)', [nama_toko.trim()]);
        const tenant = db.get('SELECT id FROM tenants ORDER BY id DESC LIMIT 1');
        const tenantId = tenant.id;

        const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
        db.run('INSERT INTO users (tenant_id, email, password, nama_lengkap, role) VALUES (?, ?, ?, ?, ?)', 
            [tenantId, email, hashedPassword, nama_lengkap || null, 'admin']);
        
        const user = db.get('SELECT id, email, role, tenant_id FROM users ORDER BY id DESC LIMIT 1');
        seedTenantData(tenantId);

        const accessToken = generateAccessToken(user);
        const { token: refreshToken } = await generateRefreshToken(user.id);

        return successResponse(res, {
            accessToken,
            refreshToken,
            user: { id: user.id, email: user.email, role: user.role, tenant_id: user.tenant_id, nama_toko }
        }, 'Registrasi berhasil — toko Anda telah siap digunakan', 201);
    } catch (err) {
        console.error(err);
        return errorResponse(res, 'Server error', 500);
    }
};

// Login
const login = async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return errorResponse(res, 'Email dan password wajib diisi');

    try {
        const user = db.get('SELECT * FROM users WHERE email = ?', [email]);
        if (!user) {
            await bcrypt.compare(password, '$2a$12$dummyhashdummyhashdummyhashdummyhashdummyhash');
            return errorResponse(res, 'Email atau password salah', 401);
        }

        if (user.locked_until && new Date(user.locked_until) > new Date()) {
            return errorResponse(res, 'Akun terkunci. Coba lagi nanti.', 423);
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            const newAttempts = (user.failed_attempts || 0) + 1;
            db.run('UPDATE users SET failed_attempts = ? WHERE id = ?', [newAttempts, user.id]);
            if (newAttempts >= 5) {
                const lockTime = new Date(Date.now() + 15 * 60000).toISOString();
                db.run('UPDATE users SET locked_until = ? WHERE id = ?', [lockTime, user.id]);
            }
            return errorResponse(res, 'Email atau password salah', 401);
        }

        db.run('UPDATE users SET failed_attempts = 0, locked_until = NULL WHERE id = ?', [user.id]);

        const accessToken = generateAccessToken(user);
        const { token: refreshToken } = await generateRefreshToken(user.id);

        const tenant = db.get('SELECT nama_toko FROM tenants WHERE id = ?', [user.tenant_id]);

        return successResponse(res, {
            accessToken,
            refreshToken,
            user: { id: user.id, email: user.email, role: user.role, tenant_id: user.tenant_id, nama_toko: tenant ? tenant.nama_toko : '' }
        }, 'Login berhasil');
    } catch (err) {
        console.error(err);
        return errorResponse(res, 'Server error', 500);
    }
};

// Refresh token
const refreshToken = async (req, res) => {
    const { refreshToken: token } = req.body;
    if (!token) return errorResponse(res, 'Refresh token diperlukan');

    try {
        const tokenData = db.get('SELECT * FROM refresh_tokens WHERE token = ?', [token]);
        if (!tokenData) return errorResponse(res, 'Token tidak valid', 401);
        if (tokenData.revoked) {
            db.run('UPDATE refresh_tokens SET revoked = 1 WHERE family = ?', [tokenData.family]);
            return errorResponse(res, 'Token tidak valid', 401);
        }
        if (new Date(tokenData.expires_at) < new Date()) {
            return errorResponse(res, 'Token expired', 401);
        }

        db.run('UPDATE refresh_tokens SET revoked = 1 WHERE id = ?', [tokenData.id]);
        const newToken = crypto.randomBytes(64).toString('hex');
        const newExpiry = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000).toISOString();
        db.run('INSERT INTO refresh_tokens (user_id, token, family, expires_at) VALUES (?, ?, ?, ?)', 
            [tokenData.user_id, newToken, tokenData.family, newExpiry]);

        const user = db.get('SELECT id, email, role, tenant_id FROM users WHERE id = ?', [tokenData.user_id]);
        const accessToken = generateAccessToken(user);

        return successResponse(res, { accessToken, refreshToken: newToken }, 'Token berhasil diperbarui');
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

// Profile
const profile = async (req, res) => {
    try {
        const user = db.get('SELECT id, email, role, nama_lengkap, tenant_id, created_at FROM users WHERE id = ?', [req.user.id]);
        if (!user) return errorResponse(res, 'User tidak ditemukan', 404);
        return successResponse(res, user, 'Profil berhasil diambil');
    } catch (err) {
        console.error(err);
        return errorResponse(res, 'Server error', 500);
    }
};

// =================== MANAJEMEN USER DALAM TENANT ===================
const addUser = async (req, res) => {
    const { email, password, nama_lengkap, role } = req.body;
    const tenantId = req.user.tenant_id;

    if (!email || !password) return errorResponse(res, 'Email dan password wajib', 400);
    if (!['kasir', 'stok'].includes(role)) return errorResponse(res, 'Role harus kasir atau stok', 400);

    try {
        const exists = db.get('SELECT id FROM users WHERE email = ?', [email]);
        if (exists) return errorResponse(res, 'Email sudah terdaftar', 409);

        const hash = await bcrypt.hash(password, SALT_ROUNDS);
        db.run('INSERT INTO users (tenant_id, email, password, nama_lengkap, role) VALUES (?, ?, ?, ?, ?)',
            [tenantId, email, hash, nama_lengkap || null, role]);

        return successResponse(res, null, 'User berhasil ditambahkan', 201);
    } catch (err) {
        console.error(err);
        return errorResponse(res, 'Server error', 500);
    }
};

const listUsers = async (req, res) => {
    const tenantId = req.user.tenant_id;
    const users = db.all('SELECT id, email, nama_lengkap, role, created_at FROM users WHERE tenant_id = ?', [tenantId]);
    return successResponse(res, users, 'Daftar user');
};

module.exports = { register, login, refreshToken, logout, profile, addUser, listUsers };