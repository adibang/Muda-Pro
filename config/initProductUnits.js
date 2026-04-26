const { db } = require('./database');

function initProductUnits() {
  db.run(`
    CREATE TABLE IF NOT EXISTS produk_satuan (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      produk_id INTEGER,
      varian_id INTEGER,
      satuan_id INTEGER NOT NULL REFERENCES satuan(id),
      barcode TEXT,
      faktor_konversi REAL NOT NULL DEFAULT 1,
      harga_jual REAL,
      is_default INTEGER DEFAULT 0,
      deleted INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT (datetime('now','localtime')),
      updated_at DATETIME DEFAULT (datetime('now','localtime'))
    )
  `);
}

module.exports = initProductUnits;