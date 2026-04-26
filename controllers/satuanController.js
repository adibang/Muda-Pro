const { db } = require('../config/database');
const { successResponse, errorResponse } = require('../utils/response');

const getAll = (req, res) => {
    try {
        const data = db.all('SELECT * FROM satuan WHERE deleted = 0 ORDER BY nama');
        return successResponse(res, data);
    } catch (err) {
        return errorResponse(res, err.message, 500);
    }
};

const getById = (req, res) => {
    try {
        const data = db.get('SELECT * FROM satuan WHERE id = ? AND deleted = 0', [req.params.id]);
        if (!data) return errorResponse(res, 'Satuan tidak ditemukan', 404);
        return successResponse(res, data);
    } catch (err) {
        return errorResponse(res, err.message, 500);
    }
};

const create = (req, res) => {
    try {
        db.run('INSERT INTO satuan (nama) VALUES (?)', [req.body.nama]);
        const data = db.get('SELECT * FROM satuan ORDER BY id DESC LIMIT 1');
        return successResponse(res, data, 'Satuan berhasil dibuat', 201);
    } catch (err) {
        return errorResponse(res, err.message, 500);
    }
};

const update = (req, res) => {
    try {
        db.run('UPDATE satuan SET nama = ?, updated_at = datetime(\'now\') WHERE id = ?', [req.body.nama, req.params.id]);
        const data = db.get('SELECT * FROM satuan WHERE id = ?', [req.params.id]);
        if (!data) return errorResponse(res, 'Satuan tidak ditemukan', 404);
        return successResponse(res, data, 'Satuan berhasil diperbarui');
    } catch (err) {
        return errorResponse(res, err.message, 500);
    }
};

const remove = (req, res) => {
    try {
        db.run('UPDATE satuan SET deleted = 1, updated_at = datetime(\'now\') WHERE id = ?', [req.params.id]);
        return successResponse(res, null, 'Satuan berhasil dihapus');
    } catch (err) {
        return errorResponse(res, err.message, 500);
    }
};

module.exports = { getAll, getById, create, update, remove };