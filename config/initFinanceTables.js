const { db } = require('./database');

function initFinanceTables() {
  db.run(`
    CREATE TABLE IF NOT EXISTS akun (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      kode TEXT UNIQUE NOT NULL,
      nama TEXT NOT NULL,
      tipe TEXT CHECK(tipe IN ('aset','kewajiban','ekuitas','pendapatan','beban','beban_lain')) NOT NULL,
      saldo_normal TEXT CHECK(saldo_normal IN ('debit','kredit')) NOT NULL,
      created_at TEXT DEFAULT (datetime('now','localtime'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS jurnal (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL REFERENCES tenants(id),
      nomor TEXT UNIQUE NOT NULL,
      tanggal DATE NOT NULL DEFAULT (date('now','localtime')),
      deskripsi TEXT,
      referensi TEXT,
      user_id INTEGER,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS jurnal_detail (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL REFERENCES tenants(id),
      jurnal_id INTEGER NOT NULL,
      akun_id INTEGER NOT NULL,
      debit REAL DEFAULT 0,
      kredit REAL DEFAULT 0,
      FOREIGN KEY (jurnal_id) REFERENCES jurnal(id) ON DELETE CASCADE,
      FOREIGN KEY (akun_id) REFERENCES akun(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS piutang (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL REFERENCES tenants(id),
      customer_id INTEGER NOT NULL,
      transaksi_id INTEGER NOT NULL,
      total REAL NOT NULL,
      sisa REAL NOT NULL,
      status TEXT CHECK(status IN ('belum_lunas','lunas')) DEFAULT 'belum_lunas',
      created_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (customer_id) REFERENCES customer(id),
      FOREIGN KEY (transaksi_id) REFERENCES transaksi(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS pembayaran_piutang (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL REFERENCES tenants(id),
      piutang_id INTEGER NOT NULL,
      tanggal DATE NOT NULL DEFAULT (date('now','localtime')),
      jumlah REAL NOT NULL,
      user_id INTEGER,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (piutang_id) REFERENCES piutang(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS hutang (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL REFERENCES tenants(id),
      supplier_id INTEGER NOT NULL,
      po_id INTEGER NOT NULL,
      total REAL NOT NULL,
      sisa REAL NOT NULL,
      status TEXT CHECK(status IN ('belum_lunas','lunas')) DEFAULT 'belum_lunas',
      created_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (supplier_id) REFERENCES supplier(id),
      FOREIGN KEY (po_id) REFERENCES purchase_order(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS pembayaran_hutang (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL REFERENCES tenants(id),
      hutang_id INTEGER NOT NULL,
      tanggal DATE NOT NULL DEFAULT (date('now','localtime')),
      jumlah REAL NOT NULL,
      user_id INTEGER,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (hutang_id) REFERENCES hutang(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS kas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL REFERENCES tenants(id),
      tipe TEXT CHECK(tipe IN ('masuk','keluar')) NOT NULL,
      tanggal DATE NOT NULL DEFAULT (date('now','localtime')),
      jumlah REAL NOT NULL,
      akun_id INTEGER NOT NULL,
      deskripsi TEXT,
      user_id INTEGER,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (akun_id) REFERENCES akun(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  // Seed akun standar (global, bisa dibagi)
  const existing = db.get('SELECT COUNT(*) as count FROM akun');
  if (existing && existing.count === 0) {
    const akunList = [
      ['101', 'Kas', 'aset', 'debit'],
      ['102', 'Piutang Usaha', 'aset', 'debit'],
      ['103', 'Persediaan Barang', 'aset', 'debit'],
      ['201', 'Hutang Usaha', 'kewajiban', 'kredit'],
      ['301', 'Modal', 'ekuitas', 'kredit'],
      ['401', 'Penjualan', 'pendapatan', 'kredit'],
      ['501', 'HPP', 'beban', 'debit'],
      ['601', 'Diskon Penjualan', 'beban', 'debit'],
      ['701', 'Beban Operasional', 'beban', 'debit']
    ];
    akunList.forEach(a => {
      db.run('INSERT INTO akun (kode, nama, tipe, saldo_normal) VALUES (?, ?, ?, ?)', [a[0], a[1], a[2], a[3]]);
    });
  }

  console.log('Finance tables initialized with tenant_id');
}

module.exports = initFinanceTables;