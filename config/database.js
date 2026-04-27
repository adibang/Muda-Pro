const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'data', 'pos.db');

if (!fs.existsSync(path.dirname(DB_PATH))) {
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
}

let dbInstance = null;

function saveDatabase() {
    if (!dbInstance) return;
    const data = dbInstance.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_PATH, buffer);
}

async function initDatabase() {
    const SQL = await initSqlJs();

    if (fs.existsSync(DB_PATH)) {
        const fileBuffer = fs.readFileSync(DB_PATH);
        dbInstance = new SQL.Database(fileBuffer);
        console.log('Database loaded from disk.');
    } else {
        dbInstance = new SQL.Database();
        console.log('New database created in memory.');
    }

    dbInstance.run('PRAGMA journal_mode=WAL;');
    dbInstance.run('PRAGMA foreign_keys=ON;');

    // ---------- TABEL TENANTS ----------
    dbInstance.run(`CREATE TABLE IF NOT EXISTS tenants (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nama_toko TEXT NOT NULL,
        alamat TEXT,
        telepon TEXT,
        aktif INTEGER DEFAULT 1,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
    )`);

    // ---------- TABEL USERS ----------
    dbInstance.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tenant_id INTEGER REFERENCES tenants(id),
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        nama_lengkap TEXT,
        role TEXT CHECK(role IN ('admin', 'kasir', 'stok')) DEFAULT 'kasir',
        failed_attempts INTEGER DEFAULT 0,
        locked_until TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
    )`);

    // ---------- TABEL REFRESH TOKENS ----------
    dbInstance.run(`CREATE TABLE IF NOT EXISTS refresh_tokens (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER REFERENCES users(id),
        token TEXT UNIQUE NOT NULL,
        family TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        revoked INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now'))
    )`);

    // ---------- TABEL KATEGORI ----------
    dbInstance.run(`CREATE TABLE IF NOT EXISTS kategori (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tenant_id INTEGER REFERENCES tenants(id),
        nama TEXT NOT NULL,
        deleted INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
    )`);

    // ---------- TABEL SATUAN ----------
    dbInstance.run(`CREATE TABLE IF NOT EXISTS satuan (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tenant_id INTEGER REFERENCES tenants(id),
        nama TEXT NOT NULL,
        deleted INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
    )`);

    // ---------- TABEL GUDANG ----------
    dbInstance.run(`CREATE TABLE IF NOT EXISTS gudang (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tenant_id INTEGER REFERENCES tenants(id),
        kode TEXT NOT NULL,
        nama TEXT NOT NULL,
        lokasi TEXT,
        kapasitas REAL,
        deleted INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
    )`);

    // ---------- TABEL CUSTOMER ----------
    dbInstance.run(`CREATE TABLE IF NOT EXISTS customer (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tenant_id INTEGER REFERENCES tenants(id),
        kode TEXT UNIQUE,
        nama TEXT NOT NULL,
        kontak TEXT,
        outstanding REAL DEFAULT 0,
        deleted INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
    )`);

    // ---------- TABEL SUPPLIER ----------
    dbInstance.run(`CREATE TABLE IF NOT EXISTS supplier (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tenant_id INTEGER REFERENCES tenants(id),
        kode TEXT UNIQUE,
        nama TEXT NOT NULL,
        kontak TEXT,
        deleted INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
    )`);

    // ---------- TABEL PRODUK ----------
    dbInstance.run(`CREATE TABLE IF NOT EXISTS produk (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tenant_id INTEGER REFERENCES tenants(id),
        kode TEXT UNIQUE,
        nama TEXT NOT NULL,
        barcode TEXT,
        harga_dasar REAL,
        harga_jual REAL,
        berat REAL,
        diskon REAL DEFAULT 0,
        stok_awal REAL DEFAULT 0,
        stok_minimal REAL DEFAULT 0,
        produk_timbangan INTEGER DEFAULT 0,
        kategori_id INTEGER REFERENCES kategori(id),
        satuan_id INTEGER REFERENCES satuan(id),
        gudang_id INTEGER REFERENCES gudang(id),
        deleted INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
    )`);

    // ---------- TABEL VARIAN PRODUK ----------
    dbInstance.run(`CREATE TABLE IF NOT EXISTS varian_produk (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tenant_id INTEGER REFERENCES tenants(id),
        produk_id INTEGER REFERENCES produk(id),
        nama_varian TEXT NOT NULL,
        barcode TEXT,
        harga_dasar REAL,
        harga_jual REAL,
        stok REAL DEFAULT 0,
        poin INTEGER,
        komisi REAL,
        deleted INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
    )`);

    saveDatabase();
    console.log('Database core tables initialized');
}

// ---------- WRAPPER FUNGSI ----------
const db = {
    run: (sql, params = []) => {
        if (!dbInstance) throw new Error('Database not initialized');
        try {
            dbInstance.run(sql, params);
            saveDatabase();
            return { changes: dbInstance.getRowsModified() };
        } catch (err) {
            throw err;
        }
    },

    get: (sql, params = []) => {
        if (!dbInstance) throw new Error('Database not initialized');
        try {
            const stmt = dbInstance.prepare(sql);
            stmt.bind(params);
            if (stmt.step()) {
                const row = stmt.getAsObject();
                stmt.free();
                return row;
            }
            stmt.free();
            return null;
        } catch (err) {
            throw err;
        }
    },

    all: (sql, params = []) => {
        if (!dbInstance) throw new Error('Database not initialized');
        try {
            const stmt = dbInstance.prepare(sql);
            stmt.bind(params);
            const results = [];
            while (stmt.step()) {
                results.push(stmt.getAsObject());
            }
            stmt.free();
            return results;
        } catch (err) {
            throw err;
        }
    },

    exec: (sql) => {
        if (!dbInstance) throw new Error('Database not initialized');
        try {
            dbInstance.run(sql);
            saveDatabase();
        } catch (err) {
            throw err;
        }
    },

    pluck: (sql, params = []) => {
        const row = db.get(sql, params);
        if (row) {
            const keys = Object.keys(row);
            return row[keys[0]];
        }
        return null;
    }
};

module.exports = { db, initDatabase };