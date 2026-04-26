const { db } = require('../config/database');
const { successResponse, errorResponse } = require('../utils/response');

const getAll = (req, res) => {
    try {
        const data = db.all('SELECT * FROM supplier WHERE deleted = 0 ORDER BY nama');
        return successResponse(res, data);
    } catch (err) {
        return errorResponse(res, err.message, 500);
    }
};

const getById = (req, res) => {
    try {
        const data = db.get('SELECT * FROM supplier WHERE id = ? AND deleted = 0', [req.params.id]);
        if (!data) return errorResponse(res, 'Supplier tidak ditemukan', 404);
        return successResponse(res, data);
    } catch (err) {
        return errorResponse(res, err.message, 500);
    }
};

const create = (req, res) => {
    try {
        const { kode, nama, kontak } = req.body;
        if (!nama) return errorResponse(res, 'Nama wajib diisi');

        db.run('INSERT INTO supplier (kode, nama, kontak) VALUES (?, ?, ?)', 
            [kode || null, nama, kontak || null]);
        const data = db.get('SELECT * FROM supplier ORDER BY id DESC LIMIT 1');
        return successResponse(res, data, 'Supplier berhasil dibuat', 201);
    } catch (err) {
        if (err.message.includes('UNIQUE')) return errorResponse(res, 'Kode supplier sudah ada', 409);
        return errorResponse(res, err.message, 500);
    }
};

const update = (req, res) => {
    try {
        const { kode, nama, kontak } = req.body;
        db.run('UPDATE supplier SET kode = ?, nama = ?, kontak = ?, updated_at = datetime(\'now\') WHERE id = ?', 
            [kode, nama, kontak, req.params.id]);
        const data = db.get('SELECT * FROM supplier WHERE id = ?', [req.params.id]);
        if (!data) return errorResponse(res, 'Supplier tidak ditemukan', 404);
        return successResponse(res, data, 'Supplier berhasil diperbarui');
    } catch (err) {
        return errorResponse(res, err.message, 500);
    }
};

const remove = (req, res) => {
    try {
        db.run('UPDATE supplier SET deleted = 1, updated_at = datetime(\'now\') WHERE id = ?', [req.params.id]);
        return successResponse(res, null, 'Supplier berhasil dihapus');
    } catch (err) {
        return errorResponse(res, err.message, 500);
    }
};

module.exports = { getAll, getById, create, update, remove };