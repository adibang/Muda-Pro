// controllers/gudangController.js
const { db } = require('../config/database');
const { successResponse, errorResponse } = require('../utils/response');

const getAll = async (req, res) => {
    try {
        const tenantId = req.user.tenant_id;
        const data = db.all('SELECT * FROM gudang WHERE tenant_id = ? AND deleted = 0 ORDER BY nama', [tenantId]);
        return successResponse(res, data, 'Gudang retrieved successfully');
    } catch (err) {
        return errorResponse(res, err.message, 500);
    }
};

const getById = async (req, res) => {
    try {
        const tenantId = req.user.tenant_id;
        const data = db.get('SELECT * FROM gudang WHERE id = ? AND tenant_id = ? AND deleted = 0', [req.params.id, tenantId]);
        if (!data) return errorResponse(res, 'Gudang not found', 404);
        return successResponse(res, data, 'Gudang retrieved successfully');
    } catch (err) {
        return errorResponse(res, err.message, 500);
    }
};

const create = async (req, res) => {
    try {
        const tenantId = req.user.tenant_id;
        const { kode, nama, lokasi, kapasitas } = req.body;
        db.run('INSERT INTO gudang (tenant_id, kode, nama, lokasi, kapasitas) VALUES (?, ?, ?, ?, ?)', [tenantId, kode, nama, lokasi || null, kapasitas || null]);
        const data = db.get('SELECT * FROM gudang WHERE id = last_insert_rowid() AND tenant_id = ?', [tenantId]);
        return successResponse(res, data, 'Gudang created successfully', 201);
    } catch (err) {
        return errorResponse(res, err.message, 500);
    }
};

const update = async (req, res) => {
    try {
        const tenantId = req.user.tenant_id;
        const { kode, nama, lokasi, kapasitas } = req.body;
        db.run('UPDATE gudang SET kode = ?, nama = ?, lokasi = ?, kapasitas = ?, updated_at = datetime(\'now\') WHERE id = ? AND tenant_id = ?', [kode, nama, lokasi || null, kapasitas || null, req.params.id, tenantId]);
        const data = db.get('SELECT * FROM gudang WHERE id = ? AND tenant_id = ?', [req.params.id, tenantId]);
        if (!data) return errorResponse(res, 'Gudang not found', 404);
        return successResponse(res, data, 'Gudang updated successfully');
    } catch (err) {
        return errorResponse(res, err.message, 500);
    }
};

const remove = async (req, res) => {
    try {
        const tenantId = req.user.tenant_id;
        db.run('UPDATE gudang SET deleted = 1, updated_at = datetime(\'now\') WHERE id = ? AND tenant_id = ?', [req.params.id, tenantId]);
        return successResponse(res, null, 'Gudang deleted successfully');
    } catch (err) {
        return errorResponse(res, err.message, 500);
    }
};

module.exports = { getAll, getById, create, update, remove };