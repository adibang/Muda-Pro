const { db } = require('./database');

function initConfigTables() {
  // Tabel pengaturan menyimpan key-value
  db.run(`
    CREATE TABLE IF NOT EXISTS pengaturan (
      kunci TEXT PRIMARY KEY,
      nilai TEXT NOT NULL,
      updated_at DATETIME DEFAULT (datetime('now','localtime'))
    )
  `);

  // Seeding default jika belum ada
  const defaults = {
    barcode_prefix: '28',
    barcode_plu_length: '6',
    barcode_weight_length: '5',
    barcode_weight_scale: '1000'   // pembagi: gram -> kg, 3 desimal
  };

  for (const [kunci, nilai] of Object.entries(defaults)) {
    const existing = db.get('SELECT kunci FROM pengaturan WHERE kunci = ?', [kunci]);
    if (!existing) {
      db.run('INSERT INTO pengaturan (kunci, nilai) VALUES (?, ?)', [kunci, nilai]);
    }
  }
}

module.exports = initConfigTables;