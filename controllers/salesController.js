const { db } = require('../config/database');
const { successResponse, errorResponse } = require('../utils/response');

const salesController = {
  // POST /api/sales
  create: (req, res) => {
    try {
      const {
        customer_id,
        gudang_id = 1,
        items,
        diskon_persen = 0,
        diskon_nominal = 0,
        pajak_persen = 0,
        pajak_nominal = 0,
        dibayar,
        metode_pembayaran = 'tunai',
        catatan = ''
      } = req.body;

      if (!Array.isArray(items) || items.length === 0) {
        return errorResponse(res, 'Item transaksi tidak boleh kosong', 400);
      }

      const userId = req.user.id;
      let totalSebelumDiskon = 0;
      const detailList = [];

      for (const item of items) {
        // Destructure dengan default, termasuk barcode_mentah opsional
        let {
          produk_id = null,
          varian_id = null,
          produk_satuan_id = null,
          kuantitas,
          diskon_persen: itemDiskonPersen = 0,
          diskon_nominal: itemDiskonNominal = 0,
          barcode_mentah = null
        } = item;

        // ========== PARSING BARCODE TIMBANGAN (JIKA ADA) ==========
        if (barcode_mentah) {
          // Ambil konfigurasi barcode dari tabel pengaturan
          const configRows = db.all("SELECT kunci, nilai FROM pengaturan WHERE kunci LIKE 'barcode_%'");
          const config = {};
          for (const row of configRows) {
            config[row.kunci] = row.nilai;
          }
          const prefix = config.barcode_prefix || '';
          const pluLen = parseInt(config.barcode_plu_length) || 6;
          const weightLen = parseInt(config.barcode_weight_length) || 5;
          const weightScale = parseFloat(config.barcode_weight_scale) || 1000;

          const barcode = barcode_mentah.trim();

          // Cek prefix jika ada
          if (prefix && !barcode.startsWith(prefix)) {
            return errorResponse(res, `Prefix barcode tidak dikenali, diharapkan ${prefix}`, 400);
          }

          const startPLU = prefix.length;
          const startWeight = startPLU + pluLen;
          if (barcode.length < startWeight + weightLen) {
            return errorResponse(res, 'Format barcode tidak sesuai panjang', 400);
          }

          const pluCode = barcode.substring(startPLU, startWeight);
          const weightStr = barcode.substring(startWeight, startWeight + weightLen);
          const weightRaw = parseInt(weightStr, 10);
          if (isNaN(weightRaw)) {
            return errorResponse(res, 'Berat dalam barcode tidak valid', 400);
          }

          const kuantitasParsed = weightRaw / weightScale;

          // Cari produk berdasarkan kode (PLU)
          const produkByBarcode = db.get('SELECT * FROM produk WHERE kode = ? AND deleted = 0', [pluCode]);
          if (!produkByBarcode) {
            return errorResponse(res, `Produk dengan kode '${pluCode}' tidak ditemukan`, 404);
          }

          // Atur nilai untuk pemrosesan selanjutnya
          produk_id = produkByBarcode.id;
          varian_id = null;          // barcode timbangan umumnya produk tanpa varian
          produk_satuan_id = null;   // gunakan satuan dasar
          kuantitas = kuantitasParsed;
        }

        // ========== SELANJUTNYA PENGECEKAN SEPERTI BIASA ==========
        let hargaSatuan;
        let stokTersedia;
        let satuanDasar = null;

        if (produk_satuan_id) {
          const produkSatuan = db.get(
            `SELECT ps.*, st.nama AS satuan_nama
             FROM produk_satuan ps
             JOIN satuan st ON ps.satuan_id = st.id
             WHERE ps.id = ? AND ps.deleted = 0`,
            [produk_satuan_id]
          );
          if (!produkSatuan) {
            return errorResponse(res, `Satuan dengan id ${produk_satuan_id} tidak ditemukan`, 404);
          }

          if (produkSatuan.produk_id !== produk_id) {
            return errorResponse(res, 'Satuan tidak sesuai dengan produk', 400);
          }
          if (produkSatuan.varian_id !== null) {
            if (!varian_id || produkSatuan.varian_id !== varian_id) {
              return errorResponse(res, 'Satuan tidak sesuai dengan varian', 400);
            }
          }

          if (produkSatuan.varian_id) {
            const varian = db.get(`SELECT harga_jual, stok FROM varian_produk WHERE id = ? AND deleted = 0`, [produkSatuan.varian_id]);
            if (!varian) return errorResponse(res, 'Varian tidak ditemukan', 404);
            stokTersedia = varian.stok;
            hargaSatuan = produkSatuan.harga_jual !== null ? produkSatuan.harga_jual : varian.harga_jual;
          } else {
            const produk = db.get(`SELECT harga_jual, stok_awal FROM produk WHERE id = ? AND deleted = 0`, [produkSatuan.produk_id]);
            if (!produk) return errorResponse(res, 'Produk tidak ditemukan', 404);
            stokTersedia = produk.stok_awal;
            hargaSatuan = produkSatuan.harga_jual !== null ? produkSatuan.harga_jual : produk.harga_jual;
          }
          satuanDasar = produkSatuan.faktor_konversi;

        } else if (varian_id) {
          const varian = db.get(`SELECT harga_jual, stok FROM varian_produk WHERE id = ? AND deleted = 0`, [varian_id]);
          if (!varian) return errorResponse(res, 'Varian tidak ditemukan', 404);
          stokTersedia = varian.stok;
          hargaSatuan = varian.harga_jual;
          satuanDasar = 1;

        } else {
          const produk = db.get(`SELECT harga_jual, stok_awal FROM produk WHERE id = ? AND deleted = 0`, [produk_id]);
          if (!produk) return errorResponse(res, 'Produk tidak ditemukan', 404);
          stokTersedia = produk.stok_awal;
          hargaSatuan = produk.harga_jual;
          satuanDasar = 1;
        }

        const kuantitasDasar = kuantitas * satuanDasar;
        if (stokTersedia < kuantitasDasar) {
          return errorResponse(res, `Stok tidak mencukupi`, 400);
        }
                // Cek harga bertingkat (tiered pricing)
        const tier = db.get(
          `SELECT harga FROM harga_bertingkat
           WHERE produk_id = ? AND (varian_id = ? OR varian_id IS NULL)
                 AND min_qty <= ? AND (max_qty IS NULL OR max_qty > ?)
                 AND deleted = 0
           ORDER BY min_qty DESC LIMIT 1`,
          [produk_id, varian_id || 0, kuantitasDasar, kuantitasDasar]
        );
        if (tier) {
          hargaSatuan = tier.harga;   // gunakan harga bertingkat
        }

        const subtotalItem = (kuantitas * hargaSatuan)
          - itemDiskonNominal
          - (itemDiskonPersen / 100 * kuantitas * hargaSatuan);

        detailList.push({
          produk_id,
          varian_id,
          produk_satuan_id,
          kuantitas: kuantitasDasar,
          harga_satuan: hargaSatuan,
          diskon_persen: itemDiskonPersen,
          diskon_nominal: itemDiskonNominal,
          subtotal: subtotalItem
        });
        totalSebelumDiskon += subtotalItem;
      }
            // Cek kecocokan paket
      let paketDitemukan = null;
      const semuaPaket = db.all(`SELECT * FROM paket WHERE deleted = 0`);
      for (const paket of semuaPaket) {
        const itemsPaket = db.all(`SELECT * FROM paket_item WHERE paket_id = ?`, [paket.id]);
        
        // Bangun map dari detailList: key produk_id-varian_id, value kuantitas
        const keranjangMap = new Map();
        for (const d of detailList) {
          const key = `${d.produk_id}-${d.varian_id ?? 0}`;
          keranjangMap.set(key, (keranjangMap.get(key) || 0) + d.kuantitas);
        }
        
        // Bangun map dari itemsPaket
        const paketMap = new Map();
        for (const ip of itemsPaket) {
          const key = `${ip.produk_id}-${ip.varian_id ?? 0}`;
          paketMap.set(key, (paketMap.get(key) || 0) + ip.kuantitas);
        }

        // Bandingkan
        if (keranjangMap.size === paketMap.size) {
          let sama = true;
          for (const [k, v] of paketMap.entries()) {
            if (keranjangMap.get(k) !== v) { sama = false; break; }
          }
          if (sama) {
            paketDitemukan = paket;
            break;
          }
        }
      }

      // Jika paket ditemukan, abaikan harga normal dan gunakan harga_paket
      if (paketDitemukan) {
        totalSebelumDiskon = paketDitemukan.harga_paket;
      }

      // ========== DISKON GLOBAL ==========
      let totalSetelahDiskon = totalSebelumDiskon - diskon_nominal;
      if (diskon_persen > 0) {
        totalSetelahDiskon -= (diskon_persen / 100) * totalSebelumDiskon;
      }

      // ========== PAJAK ==========
      let totalAkhir = totalSetelahDiskon + pajak_nominal;
      if (pajak_persen > 0) {
        totalAkhir += (pajak_persen / 100) * totalSetelahDiskon;
      }

      if (typeof dibayar !== 'number' || dibayar < totalAkhir) {
        return errorResponse(res, 'Pembayaran kurang dari total akhir', 400);
      }
      const kembalian = dibayar - totalAkhir;

      // ===== INSERT TRANSAKSI =====
      const tempNomor = 'TEMP-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
      const now = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

      db.run(
        `INSERT INTO transaksi (nomor, tanggal, customer_id, gudang_id, user_id,
          total_sebelum_diskon, diskon_persen, diskon_nominal, total_setelah_diskon,
          pajak_persen, pajak_nominal, total_akhir, dibayar, kembalian, metode_pembayaran, catatan)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          tempNomor, now, customer_id || null, gudang_id, userId,
          totalSebelumDiskon, diskon_persen, diskon_nominal, totalSetelahDiskon,
          pajak_persen, pajak_nominal, totalAkhir, dibayar, kembalian, metode_pembayaran, catatan
        ]
      );

      const idRow = db.get('SELECT id FROM transaksi WHERE nomor = ?', [tempNomor]);
      if (!idRow) {
        db.run('DELETE FROM transaksi WHERE nomor = ?', [tempNomor]);
        return errorResponse(res, 'Gagal membuat transaksi', 500);
      }
      const transaksiId = idRow.id;

      const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const nomorFinal = `TRX-${today}-${String(transaksiId).padStart(4, '0')}`;
      db.run('UPDATE transaksi SET nomor = ? WHERE id = ?', [nomorFinal, transaksiId]);

      // ===== INSERT DETAIL & UPDATE STOK =====
      for (const detail of detailList) {
        db.run(
          `INSERT INTO transaksi_detail (transaksi_id, produk_id, varian_id, kuantitas, harga_satuan, diskon_persen, diskon_nominal, subtotal)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            transaksiId, detail.produk_id, detail.varian_id,
            detail.kuantitas, detail.harga_satuan,
            detail.diskon_persen, detail.diskon_nominal, detail.subtotal
          ]
        );
        if (detail.varian_id) {
          db.run(`UPDATE varian_produk SET stok = stok - ? WHERE id = ?`, [detail.kuantitas, detail.varian_id]);
        } else {
          db.run(`UPDATE produk SET stok_awal = stok_awal - ? WHERE id = ?`, [detail.kuantitas, detail.produk_id]);
        }
      }

      // ===== RESPONSE =====
      const transaksi = db.get(
        `SELECT t.*, c.nama AS customer_nama, g.nama AS gudang_nama, u.nama_lengkap AS kasir_nama
         FROM transaksi t
         LEFT JOIN customer c ON t.customer_id = c.id
         LEFT JOIN gudang g ON t.gudang_id = g.id
         LEFT JOIN users u ON t.user_id = u.id
         WHERE t.id = ?`,
        [transaksiId]
      );
      if (!transaksi) {
        return errorResponse(res, 'Gagal mengambil data transaksi', 500);
      }

      const details = db.all(
        `SELECT td.*, p.nama AS produk_nama, v.nama_varian AS varian_nama
         FROM transaksi_detail td
         LEFT JOIN produk p ON td.produk_id = p.id
         LEFT JOIN varian_produk v ON td.varian_id = v.id
         WHERE td.transaksi_id = ?`,
        [transaksiId]
      );
      transaksi.detail = details;

      return successResponse(res, 'Transaksi berhasil dibuat', transaksi, 201);
    } catch (error) {
      return errorResponse(res, error.message, 500);
    }
  },

  // GET /api/sales?start_date=&end_date=&customer_id=&gudang_id=
  getAll: (req, res) => {
    try {
      let sql = `SELECT t.*, c.nama AS customer_nama, g.nama AS gudang_nama, u.nama_lengkap AS kasir_nama
                 FROM transaksi t
                 LEFT JOIN customer c ON t.customer_id = c.id
                 LEFT JOIN gudang g ON t.gudang_id = g.id
                 LEFT JOIN users u ON t.user_id = u.id
                 WHERE t.deleted = 0`;
      const params = [];
      if (req.query.start_date) {
        sql += ` AND t.tanggal >= ?`;
        params.push(req.query.start_date);
      }
      if (req.query.end_date) {
        sql += ` AND t.tanggal <= ?`;
        params.push(req.query.end_date);
      }
      if (req.query.customer_id) {
        sql += ` AND t.customer_id = ?`;
        params.push(req.query.customer_id);
      }
      if (req.query.gudang_id) {
        sql += ` AND t.gudang_id = ?`;
        params.push(req.query.gudang_id);
      }
      sql += ` ORDER BY t.created_at DESC`;
      const transaksi = db.all(sql, params);
      return successResponse(res, 'Daftar transaksi berhasil diambil', transaksi);
    } catch (error) {
      return errorResponse(res, error.message, 500);
    }
  },

  // GET /api/sales/:id
  getById: (req, res) => {
    try {
      const { id } = req.params;
      const transaksi = db.get(
        `SELECT t.*, c.nama AS customer_nama, g.nama AS gudang_nama, u.nama_lengkap AS kasir_nama
         FROM transaksi t
         LEFT JOIN customer c ON t.customer_id = c.id
         LEFT JOIN gudang g ON t.gudang_id = g.id
         LEFT JOIN users u ON t.user_id = u.id
         WHERE t.id = ? AND t.deleted = 0`,
        [id]
      );
      if (!transaksi) {
        return errorResponse(res, 'Transaksi tidak ditemukan', 404);
      }
      const details = db.all(
        `SELECT td.*, p.nama AS produk_nama, v.nama_varian AS varian_nama
         FROM transaksi_detail td
         LEFT JOIN produk p ON td.produk_id = p.id
         LEFT JOIN varian_produk v ON td.varian_id = v.id
         WHERE td.transaksi_id = ?`,
        [id]
      );
      transaksi.detail = details;
      return successResponse(res, 'Detail transaksi berhasil diambil', transaksi);
    } catch (error) {
      return errorResponse(res, error.message, 500);
    }
  }
};

module.exports = salesController;