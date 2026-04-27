// controllers/customerController.js
const { db } = require('../config/database');
const { successResponse, errorResponse } = require('../utils/response');

const getAll = async (req, res) => {
    try {
        const tenantId = req.user.tenant_id;
        const data = db.all('SELECT * FROM customer WHERE tenant_id = ? AND deleted = 0 ORDER BY nama', [tenantId]);
        return successResponse(res, data, 'Customer retrieved successfully');
    } catch (err) {
        return errorResponse(res, err.message, 500);
    }
};

const getById = async (req, res) => {
    try {
        const tenantId = req.user.tenant_id;
        const data = db.get('SELECT * FROM customer WHERE id = ? AND tenant_id = ? AND deleted = 0', [req.params.id, tenantId]);
        if (!data) return errorResponse(res, 'Customer not found', 404);
        return successResponse(res, data, 'Customer retrieved successfully');
    } catch (err) {
        return errorResponse(res, err.message, 500);
    }
};

const create = async (req, res) => {
    try {
        const tenantId = req.user.tenant_id;
        const { kode, nama, kontak } = req.body;
        db.run('INSERT INTO customer (tenant_id, kode, nama, kontak) VALUES (?, ?, ?, ?)', [tenantId, kode, nama, kontak || null]);
        const data = db.get('SELECT * FROM customer WHERE id = last_insert_rowid() AND tenant_id = ?', [tenantId]);
        return successResponse(res, data, 'Customer created successfully', 201);
    } catch (err) {
        return errorResponse(res, err.message, 500);
    }
};

const update = async (req, res) => {
    try {
        const tenantId = req.user.tenant_id;
        const { kode, nama, kontak, outstanding } = req.body;
        db.run('UPDATE customer SET kode = ?, nama = ?, kontak = ?, outstanding = ?, updated_at = datetime(\'now\') WHERE id = ? AND tenant_id = ?', [kode, nama, kontak || null, outstanding || 0, req.params.id, tenantId]);
        const data = db.get('SELECT * FROM customer WHERE id = ? AND tenant_id = ?', [req.params.id, tenantId]);
        if (!data) return errorResponse(res, 'Customer not found', 404);
        return successResponse(res, data, 'Customer updated successfully');
    } catch (err) {
        return errorResponse(res, err.message, 500);
    }
};

const remove = async (req, res) => {
    try {
        const tenantId = req.user.tenant_id;
        db.run('UPDATE customer SET deleted = 1, updated_at = datetime(\'now\') WHERE id = ? AND tenant_id = ?', [req.params.id, tenantId]);
        return successResponse(res, null, 'Customer deleted successfully');
    } catch (err) {
        return errorResponse(res, err.message, 500);
    }
};

module.exports = { getAll, getById, create, update, remove };