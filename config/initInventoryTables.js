// config/initInventoryTables.js
const { db } = require('./database');

function initInventoryTables() {
  // Stok per gudang (sumber kebenaran stok)
  db.run(`
    CREATE TABLE IF NOT EXISTS stok_gudang (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      produk_id INTEGER NOT NULL,
      varian_id INTEGER,
      gudang_id INTEGER NOT NULL,
      stok REAL NOT NULL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      updated_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (produk_id) REFERENCES produk(id),
      FOREIGN KEY (varian_id) REFERENCES varian_produk(id),
      FOREIGN KEY (gudang_id) REFERENCES gudang(id),
      UNIQUE(produk_id, varian_id, gudang_id)
    )
  `);

  // Riwayat mutasi stok
  db.run(`
    CREATE TABLE IF NOT EXISTS mutasi_stok (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tanggal DATE NOT NULL DEFAULT (date('now','localtime')),
      tipe TEXT NOT NULL CHECK(tipe IN (
        'masuk','keluar','penjualan',
        'transfer_keluar','transfer_masuk',
        'opname_masuk','opname_keluar'
      )),
      produk_id INTEGER NOT NULL,
      varian_id INTEGER,
      gudang_id INTEGER NOT NULL,
      kuantitas REAL NOT NULL,
      stok_sebelum REAL NOT NULL,
      stok_sesudah REAL NOT NULL,
      referensi TEXT,
      user_id INTEGER,
      catatan TEXT,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (produk_id) REFERENCES produk(id),
      FOREIGN KEY (varian_id) REFERENCES varian_produk(id),
      FOREIGN KEY (gudang_id) REFERENCES gudang(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  // Header transfer
  db.run(`
    CREATE TABLE IF NOT EXISTS transfer (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nomor TEXT UNIQUE NOT NULL,
      tanggal DATE NOT NULL DEFAULT (date('now','localtime')),
      gudang_asal_id INTEGER NOT NULL,
      gudang_tujuan_id INTEGER NOT NULL,
      status TEXT CHECK(status IN ('draft','completed','cancelled')) DEFAULT 'draft',
      user_id INTEGER,
      catatan TEXT,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      updated_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (gudang_asal_id) REFERENCES gudang(id),
      FOREIGN KEY (gudang_tujuan_id) REFERENCES gudang(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  // Detail transfer
  db.run(`
    CREATE TABLE IF NOT EXISTS transfer_detail (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      transfer_id INTEGER NOT NULL,
      produk_id INTEGER NOT NULL,
      varian_id INTEGER,
      kuantitas REAL NOT NULL,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (transfer_id) REFERENCES transfer(id) ON DELETE CASCADE,
      FOREIGN KEY (produk_id) REFERENCES produk(id),
      FOREIGN KEY (varian_id) REFERENCES varian_produk(id)
    )
  `);

  // Header stok opname
  db.run(`
    CREATE TABLE IF NOT EXISTS stok_opname (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nomor TEXT UNIQUE NOT NULL,
      tanggal DATE NOT NULL DEFAULT (date('now','localtime')),
      gudang_id INTEGER NOT NULL,
      status TEXT CHECK(status IN ('draft','completed','cancelled')) DEFAULT 'draft',
      user_id INTEGER,
      catatan TEXT,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      updated_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (gudang_id) REFERENCES gudang(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  // Detail stok opname (selisih dihitung manual saat insert/update)
  db.run(`
    CREATE TABLE IF NOT EXISTS stok_opname_detail (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      opname_id INTEGER NOT NULL,
      produk_id INTEGER NOT NULL,
      varian_id INTEGER,
      stok_sistem REAL NOT NULL DEFAULT 0,
      stok_fisik REAL NOT NULL DEFAULT 0,
      selisih REAL NOT NULL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (opname_id) REFERENCES stok_opname(id) ON DELETE CASCADE,
      FOREIGN KEY (produk_id) REFERENCES produk(id),
      FOREIGN KEY (varian_id) REFERENCES varian_produk(id),
      UNIQUE(opname_id, produk_id, varian_id)
    )
  `);
}

module.exports = initInventoryTables;