const { db } = require('./database');

function initSalesTables() {
  db.run(`
    CREATE TABLE IF NOT EXISTS transaksi (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL REFERENCES tenants(id),
      nomor TEXT UNIQUE NOT NULL,
      tanggal DATE NOT NULL DEFAULT (date('now','localtime')),
      customer_id INTEGER,
      gudang_id INTEGER NOT NULL DEFAULT 1,
      user_id INTEGER NOT NULL,
      total_sebelum_diskon REAL NOT NULL DEFAULT 0,
      diskon_persen REAL DEFAULT 0,
      diskon_nominal REAL DEFAULT 0,
      total_setelah_diskon REAL NOT NULL DEFAULT 0,
      pajak_persen REAL DEFAULT 0,
      pajak_nominal REAL DEFAULT 0,
      total_akhir REAL NOT NULL DEFAULT 0,
      dibayar REAL NOT NULL DEFAULT 0,
      kembalian REAL NOT NULL DEFAULT 0,
      metode_pembayaran TEXT DEFAULT 'tunai',
      catatan TEXT,
      deleted INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT (datetime('now','localtime')),
      updated_at DATETIME DEFAULT (datetime('now','localtime'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS transaksi_detail (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL REFERENCES tenants(id),
      transaksi_id INTEGER NOT NULL,
      produk_id INTEGER NOT NULL,
      varian_id INTEGER,
      kuantitas REAL NOT NULL,
      harga_satuan REAL NOT NULL,
      diskon_persen REAL DEFAULT 0,
      diskon_nominal REAL DEFAULT 0,
      subtotal REAL NOT NULL,
      created_at DATETIME DEFAULT (datetime('now','localtime')),
      updated_at DATETIME DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (transaksi_id) REFERENCES transaksi(id) ON DELETE CASCADE,
      FOREIGN KEY (produk_id) REFERENCES produk(id),
      FOREIGN KEY (varian_id) REFERENCES varian_produk(id)
    )
  `);
}

module.exports = initSalesTables;