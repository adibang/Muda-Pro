// controllers/satuanController.js
const { db } = require('../config/database');
const { successResponse, errorResponse } = require('../utils/response');

const getAll = async (req, res) => {
    try {
        const tenantId = req.user.tenant_id;
        const data = db.all('SELECT * FROM satuan WHERE tenant_id = ? AND deleted = 0 ORDER BY nama', [tenantId]);
        return successResponse(res, data, 'Satuan retrieved successfully');
    } catch (err) {
        return errorResponse(res, err.message, 500);
    }
};

const getById = async (req, res) => {
    try {
        const tenantId = req.user.tenant_id;
        const data = db.get('SELECT * FROM satuan WHERE id = ? AND tenant_id = ? AND deleted = 0', [req.params.id, tenantId]);
        if (!data) return errorResponse(res, 'Satuan not found', 404);
        return successResponse(res, data, 'Satuan retrieved successfully');
    } catch (err) {
        return errorResponse(res, err.message, 500);
    }
};

const create = async (req, res) => {
    try {
        const tenantId = req.user.tenant_id;
        db.run('INSERT INTO satuan (tenant_id, nama) VALUES (?, ?)', [tenantId, req.body.nama]);
        const data = db.get('SELECT * FROM satuan WHERE id = last_insert_rowid() AND tenant_id = ?', [tenantId]);
        return successResponse(res, data, 'Satuan created successfully', 201);
    } catch (err) {
        return errorResponse(res, err.message, 500);
    }
};

const update = async (req, res) => {
    try {
        const tenantId = req.user.tenant_id;
        const { nama } = req.body;
        db.run('UPDATE satuan SET nama = ?, updated_at = datetime(\'now\') WHERE id = ? AND tenant_id = ?', [nama, req.params.id, tenantId]);
        const data = db.get('SELECT * FROM satuan WHERE id = ? AND tenant_id = ?', [req.params.id, tenantId]);
        if (!data) return errorResponse(res, 'Satuan not found', 404);
        return successResponse(res, data, 'Satuan updated successfully');
    } catch (err) {
        return errorResponse(res, err.message, 500);
    }
};

const remove = async (req, res) => {
    try {
        const tenantId = req.user.tenant_id;
        db.run('UPDATE satuan SET deleted = 1, updated_at = datetime(\'now\') WHERE id = ? AND tenant_id = ?', [req.params.id, tenantId]);
        return successResponse(res, null, 'Satuan deleted successfully');
    } catch (err) {
        return errorResponse(res, err.message, 500);
    }
};

module.exports = { getAll, getById, create, update, remove };