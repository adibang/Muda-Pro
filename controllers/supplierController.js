// controllers/supplierController.js
const { db } = require('../config/database');
const { successResponse, errorResponse } = require('../utils/response');

const getAll = async (req, res) => {
    try {
        const tenantId = req.user.tenant_id;
        const data = db.all('SELECT * FROM supplier WHERE tenant_id = ? AND deleted = 0 ORDER BY nama', [tenantId]);
        return successResponse(res, data, 'Supplier retrieved successfully');
    } catch (err) {
        return errorResponse(res, err.message, 500);
    }
};

const getById = async (req, res) => {
    try {
        const tenantId = req.user.tenant_id;
        const data = db.get('SELECT * FROM supplier WHERE id = ? AND tenant_id = ? AND deleted = 0', [req.params.id, tenantId]);
        if (!data) return errorResponse(res, 'Supplier not found', 404);
        return successResponse(res, data, 'Supplier retrieved successfully');
    } catch (err) {
        return errorResponse(res, err.message, 500);
    }
};

const create = async (req, res) => {
    try {
        const tenantId = req.user.tenant_id;
        const { kode, nama, kontak } = req.body;
        db.run('INSERT INTO supplier (tenant_id, kode, nama, kontak) VALUES (?, ?, ?, ?)', [tenantId, kode, nama, kontak || null]);
        const data = db.get('SELECT * FROM supplier WHERE id = last_insert_rowid() AND tenant_id = ?', [tenantId]);
        return successResponse(res, data, 'Supplier created successfully', 201);
    } catch (err) {
        return errorResponse(res, err.message, 500);
    }
};

const update = async (req, res) => {
    try {
        const tenantId = req.user.tenant_id;
        const { kode, nama, kontak } = req.body;
        db.run('UPDATE supplier SET kode = ?, nama = ?, kontak = ?, updated_at = datetime(\'now\') WHERE id = ? AND tenant_id = ?', [kode, nama, kontak || null, req.params.id, tenantId]);
        const data = db.get('SELECT * FROM supplier WHERE id = ? AND tenant_id = ?', [req.params.id, tenantId]);
        if (!data) return errorResponse(res, 'Supplier not found', 404);
        return successResponse(res, data, 'Supplier updated successfully');
    } catch (err) {
        return errorResponse(res, err.message, 500);
    }
};

const remove = async (req, res) => {
    try {
        const tenantId = req.user.tenant_id;
        db.run('UPDATE supplier SET deleted = 1, updated_at = datetime(\'now\') WHERE id = ? AND tenant_id = ?', [req.params.id, tenantId]);
        return successResponse(res, null, 'Supplier deleted successfully');
    } catch (err) {
        return errorResponse(res, err.message, 500);
    }
};

module.exports = { getAll, getById, create, update, remove };