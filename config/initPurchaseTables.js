const { db } = require('./database');

function initPurchaseTables() {
  db.run(`
    CREATE TABLE IF NOT EXISTS purchase_order (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL REFERENCES tenants(id),
      nomor TEXT UNIQUE NOT NULL,
      tanggal DATE NOT NULL DEFAULT (date('now','localtime')),
      supplier_id INTEGER NOT NULL,
      gudang_id INTEGER NOT NULL DEFAULT 1,
      user_id INTEGER NOT NULL,
      status TEXT CHECK(status IN ('draft','dikirim','diterima','batal')) DEFAULT 'draft',
      total REAL NOT NULL DEFAULT 0,
      catatan TEXT,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      updated_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (supplier_id) REFERENCES supplier(id),
      FOREIGN KEY (gudang_id) REFERENCES gudang(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS purchase_order_detail (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL REFERENCES tenants(id),
      po_id INTEGER NOT NULL,
      produk_id INTEGER NOT NULL,
      varian_id INTEGER,
      kuantitas REAL NOT NULL,
      harga_beli REAL NOT NULL,
      subtotal REAL NOT NULL,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (po_id) REFERENCES purchase_order(id) ON DELETE CASCADE,
      FOREIGN KEY (produk_id) REFERENCES produk(id),
      FOREIGN KEY (varian_id) REFERENCES varian_produk(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS penerimaan (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL REFERENCES tenants(id),
      nomor TEXT UNIQUE NOT NULL,
      tanggal DATE NOT NULL DEFAULT (date('now','localtime')),
      po_id INTEGER,
      supplier_id INTEGER,
      gudang_id INTEGER NOT NULL DEFAULT 1,
      user_id INTEGER NOT NULL,
      catatan TEXT,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (po_id) REFERENCES purchase_order(id),
      FOREIGN KEY (supplier_id) REFERENCES supplier(id),
      FOREIGN KEY (gudang_id) REFERENCES gudang(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS penerimaan_detail (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL REFERENCES tenants(id),
      penerimaan_id INTEGER NOT NULL,
      produk_id INTEGER NOT NULL,
      varian_id INTEGER,
      kuantitas REAL NOT NULL,
      harga_beli REAL,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (penerimaan_id) REFERENCES penerimaan(id) ON DELETE CASCADE,
      FOREIGN KEY (produk_id) REFERENCES produk(id),
      FOREIGN KEY (varian_id) REFERENCES varian_produk(id)
    )
  `);

  console.log('Purchase tables initialized with tenant_id');
}

module.exports = initPurchaseTables;