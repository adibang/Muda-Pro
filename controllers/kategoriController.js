const { db } = require('../config/database');
const { successResponse, errorResponse } = require('../utils/response');

const getAll = async (req, res) => {
    try {
        const data = db.all('SELECT * FROM kategori WHERE deleted = 0 ORDER BY nama');
        return successResponse(res, data, 'Kategori retrieved successfully');
    } catch (err) {
        return errorResponse(res, err.message, 500);
    }
};

const getById = async (req, res) => {
    try {
        const data = db.get('SELECT * FROM kategori WHERE id = ? AND deleted = 0', [req.params.id]);
        if (!data) return errorResponse(res, 'Kategori not found', 404);
        return successResponse(res, data, 'Kategori retrieved successfully');
    } catch (err) {
        return errorResponse(res, err.message, 500);
    }
};

const create = async (req, res) => {
    try {
        db.run('INSERT INTO kategori (nama) VALUES (?)', [req.body.nama]);
        const data = db.get('SELECT * FROM kategori WHERE id = last_insert_rowid()');
        return successResponse(res, data, 'Kategori created successfully', 201);
    } catch (err) {
        return errorResponse(res, err.message, 500);
    }
};

const update = async (req, res) => {
    try {
        const { nama } = req.body;
        db.run('UPDATE kategori SET nama = ?, updated_at = datetime(\'now\') WHERE id = ?', [nama, req.params.id]);
        const data = db.get('SELECT * FROM kategori WHERE id = ?', [req.params.id]);
        if (!data) return errorResponse(res, 'Kategori not found', 404);
        return successResponse(res, data, 'Kategori updated successfully');
    } catch (err) {
        return errorResponse(res, err.message, 500);
    }
};

const remove = async (req, res) => {
    try {
        db.run('UPDATE kategori SET deleted = 1, updated_at = datetime(\'now\') WHERE id = ?', [req.params.id]);
        return successResponse(res, null, 'Kategori deleted successfully');
    } catch (err) {
        return errorResponse(res, err.message, 500);
    }
};

module.exports = { getAll, getById, create, update, remove };