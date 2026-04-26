// migrateStock.js
const { initDatabase, db } = require('./config/database');

(async () => {
  await initDatabase();
  // Pastikan tabel stok_gudang sudah ada (panggil initInventoryTables jika belum)
  const initInventoryTables = require('./config/initInventoryTables');
  initInventoryTables();

  // Ambil semua produk non-deleted
  const produkList = db.all('SELECT id, stok_awal FROM produk WHERE deleted = 0');
  for (const p of produkList) {
    if (p.stok_awal > 0) {
      const existing = db.get('SELECT id FROM stok_gudang WHERE produk_id = ? AND varian_id IS NULL AND gudang_id = 1', [p.id]);
      if (!existing) {
        db.run('INSERT INTO stok_gudang (produk_id, varian_id, gudang_id, stok) VALUES (?, NULL, 1, ?)', [p.id, p.stok_awal]);
        console.log(`Migrasi produk ${p.id} stok ${p.stok_awal} ke gudang 1`);
      }
    }
  }

  // Varian produk
  const varianList = db.all('SELECT v.id, v.produk_id, v.stok FROM varian_produk v JOIN produk p ON v.produk_id = p.id WHERE v.deleted = 0 AND p.deleted = 0');
  for (const v of varianList) {
    if (v.stok > 0) {
      const existing = db.get('SELECT id FROM stok_gudang WHERE produk_id = ? AND varian_id = ? AND gudang_id = 1', [v.produk_id, v.id]);
      if (!existing) {
        db.run('INSERT INTO stok_gudang (produk_id, varian_id, gudang_id, stok) VALUES (?, ?, 1, ?)', [v.produk_id, v.id, v.stok]);
        console.log(`Migrasi varian ${v.id} stok ${v.stok} ke gudang 1`);
      }
    }
  }
  console.log('Migrasi selesai');
})();