const { db } = require('../config/database');
const { successResponse, errorResponse } = require('../utils/response');

const getAll = (req, res) => {
    try {
        const data = db.all('SELECT * FROM gudang WHERE deleted = 0 ORDER BY nama');
        return successResponse(res, data);
    } catch (err) {
        return errorResponse(res, err.message, 500);
    }
};

const getById = (req, res) => {
    try {
        const data = db.get('SELECT * FROM gudang WHERE id = ? AND deleted = 0', [req.params.id]);
        if (!data) return errorResponse(res, 'Gudang tidak ditemukan', 404);
        return successResponse(res, data);
    } catch (err) {
        return errorResponse(res, err.message, 500);
    }
};

const create = (req, res) => {
    try {
        const { kode, nama, lokasi, kapasitas } = req.body;
        if (!kode || !nama) return errorResponse(res, 'Kode dan nama wajib diisi');

        db.run('INSERT INTO gudang (kode, nama, lokasi, kapasitas) VALUES (?, ?, ?, ?)', 
            [kode, nama, lokasi || null, kapasitas || null]);
        const data = db.get('SELECT * FROM gudang ORDER BY id DESC LIMIT 1');
        return successResponse(res, data, 'Gudang berhasil dibuat', 201);
    } catch (err) {
        if (err.message.includes('UNIQUE')) return errorResponse(res, 'Kode gudang sudah ada', 409);
        return errorResponse(res, err.message, 500);
    }
};

const update = (req, res) => {
    try {
        const { kode, nama, lokasi, kapasitas } = req.body;
        db.run('UPDATE gudang SET kode = ?, nama = ?, lokasi = ?, kapasitas = ?, updated_at = datetime(\'now\') WHERE id = ?', 
            [kode, nama, lokasi, kapasitas, req.params.id]);
        const data = db.get('SELECT * FROM gudang WHERE id = ?', [req.params.id]);
        if (!data) return errorResponse(res, 'Gudang tidak ditemukan', 404);
        return successResponse(res, data, 'Gudang berhasil diperbarui');
    } catch (err) {
        return errorResponse(res, err.message, 500);
    }
};

const remove = (req, res) => {
    try {
        db.run('UPDATE gudang SET deleted = 1, updated_at = datetime(\'now\') WHERE id = ?', [req.params.id]);
        return successResponse(res, null, 'Gudang berhasil dihapus');
    } catch (err) {
        return errorResponse(res, err.message, 500);
    }
};

module.exports = { getAll, getById, create, update, remove };