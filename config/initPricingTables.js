const { db } = require('./database');

function initPricingTables() {
  db.run(`
    CREATE TABLE IF NOT EXISTS harga_bertingkat (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      produk_id INTEGER NOT NULL,
      varian_id INTEGER,
      min_qty REAL NOT NULL,
      max_qty REAL,
      harga REAL NOT NULL,
      deleted INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT (datetime('now','localtime')),
      updated_at DATETIME DEFAULT (datetime('now','localtime'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS paket (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nama TEXT,
      tipe TEXT CHECK(tipe IN ('single','bundle')) NOT NULL DEFAULT 'single',
      produk_id INTEGER,
      varian_id INTEGER,
      harga_paket REAL NOT NULL,
      deleted INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT (datetime('now','localtime')),
      updated_at DATETIME DEFAULT (datetime('now','localtime'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS paket_item (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      paket_id INTEGER NOT NULL REFERENCES paket(id),
      produk_id INTEGER NOT NULL,
      varian_id INTEGER,
      kuantitas REAL NOT NULL
    )
  `);
}

module.exports = initPricingTables;