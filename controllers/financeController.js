const { db } = require('../config/database');
const { successResponse, errorResponse } = require('../utils/response');

const financeController = {
  // =================== GENERATE JURNAL DARI TRANSAKSI PENJUALAN ===================
  generateSalesJournal: (req, res) => {
    try {
      const tenantId = req.user.tenant_id;
      const userId = req.user.id;
      const { transaksi_id } = req.body;
      if (!transaksi_id) return errorResponse(res, 'transaksi_id diperlukan', 400);

      // Cek apakah jurnal sudah pernah dibuat
      const existJournal = db.get('SELECT id FROM jurnal WHERE referensi = ? AND tenant_id = ?', [`TRX-${transaksi_id}`, tenantId]);
      if (existJournal) return errorResponse(res, 'Jurnal untuk transaksi ini sudah ada', 400);

      const trx = db.get('SELECT * FROM transaksi WHERE id = ? AND tenant_id = ? AND deleted = 0', [transaksi_id, tenantId]);
      if (!trx) return errorResponse(res, 'Transaksi tidak ditemukan', 404);

      // Hitung HPP dari detail
      const details = db.all('SELECT td.*, p.harga_dasar FROM transaksi_detail td LEFT JOIN produk p ON td.produk_id = p.id WHERE td.transaksi_id = ?', [transaksi_id]);
      let totalHPP = 0;
      details.forEach(d => {
        totalHPP += (d.harga_dasar || 0) * d.kuantitas;
      });

      // Simpan jurnal header
      const tempNo = 'JRN-' + Date.now();
      db.run('INSERT INTO jurnal (tenant_id, nomor, tanggal, deskripsi, referensi, user_id) VALUES (?, ?, ?, ?, ?, ?)',
        [tenantId, tempNo, trx.tanggal, `Penjualan #${trx.nomor}`, trx.nomor, userId]);
      const jurnal = db.get('SELECT id FROM jurnal WHERE nomor = ?', [tempNo]);
      const jurnalId = jurnal.id;
      const nomorFinal = `JRN-${trx.tanggal.replace(/-/g,'')}-${String(jurnalId).padStart(4,'0')}`;
      db.run('UPDATE jurnal SET nomor = ? WHERE id = ?', [nomorFinal, jurnalId]);

      // Akun (global, bisa dipakai bersama karena akun bukan per tenant)
      const akunKas = db.get("SELECT id FROM akun WHERE kode = '101'");
      const akunPiutang = db.get("SELECT id FROM akun WHERE kode = '102'");
      const akunPenjualan = db.get("SELECT id FROM akun WHERE kode = '401'");
      const akunHPP = db.get("SELECT id FROM akun WHERE kode = '501'");
      const akunPersediaan = db.get("SELECT id FROM akun WHERE kode = '103'");
      const akunDiskon = db.get("SELECT id FROM akun WHERE kode = '601'");

      // Debit Kas/Piutang, Kredit Penjualan
      if (trx.metode_pembayaran === 'tunai') {
        db.run('INSERT INTO jurnal_detail (tenant_id, jurnal_id, akun_id, debit, kredit) VALUES (?, ?, ?, ?, ?)',
          [tenantId, jurnalId, akunKas.id, trx.total_akhir, 0]);
      } else {
        db.run('INSERT INTO jurnal_detail (tenant_id, jurnal_id, akun_id, debit, kredit) VALUES (?, ?, ?, ?, ?)',
          [tenantId, jurnalId, akunPiutang.id, trx.total_akhir, 0]);
        // Masukkan ke tabel piutang
        db.run('INSERT INTO piutang (tenant_id, customer_id, transaksi_id, total, sisa, status) VALUES (?, ?, ?, ?, ?, ?)',
          [tenantId, trx.customer_id, trx.id, trx.total_akhir, trx.total_akhir, 'belum_lunas']);
      }
      db.run('INSERT INTO jurnal_detail (tenant_id, jurnal_id, akun_id, debit, kredit) VALUES (?, ?, ?, ?, ?)',
        [tenantId, jurnalId, akunPenjualan.id, 0, trx.total_akhir]);

      // Debit HPP, Kredit Persediaan
      if (totalHPP > 0) {
        db.run('INSERT INTO jurnal_detail (tenant_id, jurnal_id, akun_id, debit, kredit) VALUES (?, ?, ?, ?, ?)',
          [tenantId, jurnalId, akunHPP.id, totalHPP, 0]);
        db.run('INSERT INTO jurnal_detail (tenant_id, jurnal_id, akun_id, debit, kredit) VALUES (?, ?, ?, ?, ?)',
          [tenantId, jurnalId, akunPersediaan.id, 0, totalHPP]);
      }

      // Diskon jika ada
      if (trx.diskon_nominal > 0 || trx.diskon_persen > 0) {
        const diskonTotal = trx.diskon_nominal + (trx.diskon_persen / 100 * trx.total_sebelum_diskon);
        db.run('INSERT INTO jurnal_detail (tenant_id, jurnal_id, akun_id, debit, kredit) VALUES (?, ?, ?, ?, ?)',
          [tenantId, jurnalId, akunDiskon.id, diskonTotal, 0]);
      }

      return successResponse(res, { jurnal_id: jurnalId, nomor: nomorFinal }, 'Jurnal penjualan berhasil dibuat', 201);
    } catch (error) {
      return errorResponse(res, error.message, 500);
    }
  },

  // =================== PEMBAYARAN PIUTANG ===================
  payPiutang: (req, res) => {
    try {
      const tenantId = req.user.tenant_id;
      const userId = req.user.id;
      const { piutang_id, jumlah } = req.body;
      if (!piutang_id || !jumlah) return errorResponse(res, 'piutang_id dan jumlah diperlukan', 400);

      const piutang = db.get('SELECT * FROM piutang WHERE id = ? AND tenant_id = ?', [piutang_id, tenantId]);
      if (!piutang) return errorResponse(res, 'Piutang tidak ditemukan', 404);
      if (piutang.status === 'lunas') return errorResponse(res, 'Piutang sudah lunas', 400);
      if (jumlah > piutang.sisa) return errorResponse(res, 'Jumlah melebihi sisa piutang', 400);

      db.run('INSERT INTO pembayaran_piutang (tenant_id, piutang_id, jumlah, user_id) VALUES (?, ?, ?, ?)',
        [tenantId, piutang_id, jumlah, userId]);

      const sisaBaru = piutang.sisa - jumlah;
      db.run('UPDATE piutang SET sisa = ?, status = ? WHERE id = ?',
        [sisaBaru, sisaBaru === 0 ? 'lunas' : 'belum_lunas', piutang_id]);

      // Jurnal pembayaran piutang: Kas (D) xxx, Piutang Usaha (K) xxx
      const akunKas = db.get("SELECT id FROM akun WHERE kode = '101'");
      const akunPiutang = db.get("SELECT id FROM akun WHERE kode = '102'");
      if (akunKas && akunPiutang) {
        const tempNo = 'JRN-' + Date.now();
        db.run('INSERT INTO jurnal (tenant_id, nomor, tanggal, deskripsi, referensi, user_id) VALUES (?, ?, ?, ?, ?, ?)',
          [tenantId, tempNo, new Date().toISOString().slice(0,10), `Pembayaran piutang #${piutang_id}`, `PIUT-${piutang_id}`, userId]);
        const j = db.get('SELECT id FROM jurnal WHERE nomor = ?', [tempNo]);
        const jId = j.id;
        const nomorFinal = `JRN-${new Date().toISOString().slice(0,10).replace(/-/g,'')}-${String(jId).padStart(4,'0')}`;
        db.run('UPDATE jurnal SET nomor = ? WHERE id = ?', [nomorFinal, jId]);
        db.run('INSERT INTO jurnal_detail (tenant_id, jurnal_id, akun_id, debit, kredit) VALUES (?, ?, ?, ?, ?)', [tenantId, jId, akunKas.id, jumlah, 0]);
        db.run('INSERT INTO jurnal_detail (tenant_id, jurnal_id, akun_id, debit, kredit) VALUES (?, ?, ?, ?, ?)', [tenantId, jId, akunPiutang.id, 0, jumlah]);
      }

      return successResponse(res, null, 'Pembayaran piutang berhasil dicatat');
    } catch (error) {
      return errorResponse(res, error.message, 500);
    }
  },

  // =================== PEMBAYARAN HUTANG ===================
  payHutang: (req, res) => {
    try {
      const tenantId = req.user.tenant_id;
      const userId = req.user.id;
      const { hutang_id, jumlah } = req.body;
      if (!hutang_id || !jumlah) return errorResponse(res, 'hutang_id dan jumlah diperlukan', 400);

      const hutang = db.get('SELECT * FROM hutang WHERE id = ? AND tenant_id = ?', [hutang_id, tenantId]);
      if (!hutang) return errorResponse(res, 'Hutang tidak ditemukan', 404);
      if (hutang.status === 'lunas') return errorResponse(res, 'Hutang sudah lunas', 400);
      if (jumlah > hutang.sisa) return errorResponse(res, 'Jumlah melebihi sisa hutang', 400);

      db.run('INSERT INTO pembayaran_hutang (tenant_id, hutang_id, jumlah, user_id) VALUES (?, ?, ?, ?)',
        [tenantId, hutang_id, jumlah, userId]);

      const sisaBaru = hutang.sisa - jumlah;
      db.run('UPDATE hutang SET sisa = ?, status = ? WHERE id = ?',
        [sisaBaru, sisaBaru === 0 ? 'lunas' : 'belum_lunas', hutang_id]);

      // Jurnal pembayaran hutang: Hutang Usaha (D) xxx, Kas (K) xxx
      const akunKas = db.get("SELECT id FROM akun WHERE kode = '101'");
      const akunHutang = db.get("SELECT id FROM akun WHERE kode = '201'");
      if (akunKas && akunHutang) {
        const tempNo = 'JRN-' + Date.now();
        db.run('INSERT INTO jurnal (tenant_id, nomor, tanggal, deskripsi, referensi, user_id) VALUES (?, ?, ?, ?, ?, ?)',
          [tenantId, tempNo, new Date().toISOString().slice(0,10), `Pembayaran hutang #${hutang_id}`, `HUT-${hutang_id}`, userId]);
        const j = db.get('SELECT id FROM jurnal WHERE nomor = ?', [tempNo]);
        const jId = j.id;
        const nomorFinal = `JRN-${new Date().toISOString().slice(0,10).replace(/-/g,'')}-${String(jId).padStart(4,'0')}`;
        db.run('UPDATE jurnal SET nomor = ? WHERE id = ?', [nomorFinal, jId]);
        db.run('INSERT INTO jurnal_detail (tenant_id, jurnal_id, akun_id, debit, kredit) VALUES (?, ?, ?, ?, ?)', [tenantId, jId, akunHutang.id, jumlah, 0]);
        db.run('INSERT INTO jurnal_detail (tenant_id, jurnal_id, akun_id, debit, kredit) VALUES (?, ?, ?, ?, ?)', [tenantId, jId, akunKas.id, 0, jumlah]);
      }

      return successResponse(res, null, 'Pembayaran hutang berhasil dicatat');
    } catch (error) {
      return errorResponse(res, error.message, 500);
    }
  },

  // =================== KAS MANUAL ===================
  createKas: (req, res) => {
    try {
      const tenantId = req.user.tenant_id;
      const userId = req.user.id;
      const { tipe, jumlah, akun_id, deskripsi } = req.body;
      if (!tipe || !jumlah || !akun_id) return errorResponse(res, 'tipe, jumlah, akun_id diperlukan', 400);

      db.run('INSERT INTO kas (tenant_id, tipe, jumlah, akun_id, deskripsi, user_id) VALUES (?, ?, ?, ?, ?, ?)',
        [tenantId, tipe, jumlah, akun_id, deskripsi || '', userId]);

      // Jurnal kas manual
      const akun = db.get('SELECT * FROM akun WHERE id = ?', [akun_id]);
      const akunKas = db.get("SELECT id FROM akun WHERE kode = '101'");
      if (akun && akunKas) {
        const tempNo = 'JRN-' + Date.now();
        db.run('INSERT INTO jurnal (tenant_id, nomor, tanggal, deskripsi, referensi, user_id) VALUES (?, ?, ?, ?, ?, ?)',
          [tenantId, tempNo, new Date().toISOString().slice(0,10), deskripsi || `Kas ${tipe}`, `KAS-${Date.now()}`, userId]);
        const j = db.get('SELECT id FROM jurnal WHERE nomor = ?', [tempNo]);
        const jId = j.id;
        const nomorFinal = `JRN-${new Date().toISOString().slice(0,10).replace(/-/g,'')}-${String(jId).padStart(4,'0')}`;
        db.run('UPDATE jurnal SET nomor = ? WHERE id = ?', [nomorFinal, jId]);

        if (tipe === 'masuk') {
          db.run('INSERT INTO jurnal_detail (tenant_id, jurnal_id, akun_id, debit, kredit) VALUES (?, ?, ?, ?, ?)', [tenantId, jId, akunKas.id, jumlah, 0]);
          db.run('INSERT INTO jurnal_detail (tenant_id, jurnal_id, akun_id, debit, kredit) VALUES (?, ?, ?, ?, ?)', [tenantId, jId, akun.id, 0, jumlah]);
        } else {
          db.run('INSERT INTO jurnal_detail (tenant_id, jurnal_id, akun_id, debit, kredit) VALUES (?, ?, ?, ?, ?)', [tenantId, jId, akun.id, jumlah, 0]);
          db.run('INSERT INTO jurnal_detail (tenant_id, jurnal_id, akun_id, debit, kredit) VALUES (?, ?, ?, ?, ?)', [tenantId, jId, akunKas.id, 0, jumlah]);
        }
      }

      return successResponse(res, null, 'Kas berhasil dicatat', 201);
    } catch (error) {
      return errorResponse(res, error.message, 500);
    }
  },

  // =================== NERACA SALDO ===================
  trialBalance: (req, res) => {
    try {
      const tenantId = req.user.tenant_id;
      const akunList = db.all('SELECT * FROM akun ORDER BY kode');
      const result = [];
      for (const akun of akunList) {
        const debitRow = db.get('SELECT SUM(jd.debit) as total FROM jurnal_detail jd JOIN jurnal j ON jd.jurnal_id = j.id WHERE jd.akun_id = ? AND jd.tenant_id = ?', [akun.id, tenantId]);
        const kreditRow = db.get('SELECT SUM(jd.kredit) as total FROM jurnal_detail jd JOIN jurnal j ON jd.jurnal_id = j.id WHERE jd.akun_id = ? AND jd.tenant_id = ?', [akun.id, tenantId]);
        const totalDebit = debitRow.total || 0;
        const totalKredit = kreditRow.total || 0;
        result.push({
          kode: akun.kode,
          nama: akun.nama,
          debit: totalDebit,
          kredit: totalKredit,
          saldo: akun.saldo_normal === 'debit' ? totalDebit - totalKredit : totalKredit - totalDebit
        });
      }
      return successResponse(res, result, 'Neraca saldo');
    } catch (error) {
      return errorResponse(res, error.message, 500);
    }
  },

  // =================== LAPORAN LABA/RUGI ===================
  incomeStatement: (req, res) => {
    try {
      const tenantId = req.user.tenant_id;
      const pendapatan = db.get("SELECT SUM(jd.kredit) - SUM(jd.debit) as total FROM jurnal_detail jd JOIN akun a ON jd.akun_id = a.id WHERE a.tipe = 'pendapatan' AND jd.tenant_id = ?", [tenantId]);
      const beban = db.get("SELECT SUM(jd.debit) - SUM(jd.kredit) as total FROM jurnal_detail jd JOIN akun a ON jd.akun_id = a.id WHERE a.tipe IN ('beban','beban_lain') AND jd.tenant_id = ?", [tenantId]);
      const laba = (pendapatan.total || 0) - (beban.total || 0);
      return successResponse(res, { pendapatan: pendapatan.total || 0, beban: beban.total || 0, laba_rugi: laba }, 'Laporan laba/rugi');
    } catch (error) {
      return errorResponse(res, error.message, 500);
    }
  },

  // =================== DAFTAR PIUTANG/HUTANG ===================
  listPiutang: (req, res) => {
    try {
      const tenantId = req.user.tenant_id;
      const rows = db.all('SELECT p.*, c.nama AS customer_nama FROM piutang p JOIN customer c ON p.customer_id = c.id WHERE p.status = "belum_lunas" AND p.tenant_id = ?', [tenantId]);
      return successResponse(res, rows, 'Daftar piutang');
    } catch (error) {
      return errorResponse(res, error.message, 500);
    }
  },

  listHutang: (req, res) => {
    try {
      const tenantId = req.user.tenant_id;
      const rows = db.all('SELECT h.*, s.nama AS supplier_nama FROM hutang h JOIN supplier s ON h.supplier_id = s.id WHERE h.status = "belum_lunas" AND h.tenant_id = ?', [tenantId]);
      return successResponse(res, rows, 'Daftar hutang');
    } catch (error) {
      return errorResponse(res, error.message, 500);
    }
  },

  // =================== BUKU BESAR ===================
  generalLedger: (req, res) => {
    try {
      const tenantId = req.user.tenant_id;
      const { akun_id, start_date, end_date } = req.query;
      if (!akun_id) return errorResponse(res, 'akun_id diperlukan', 400);

      const akun = db.get('SELECT * FROM akun WHERE id = ?', [akun_id]);
      if (!akun) return errorResponse(res, 'Akun tidak ditemukan', 404);

      let sql = `SELECT j.nomor AS jurnal_nomor, j.tanggal, j.deskripsi,
                        jd.debit, jd.kredit
                 FROM jurnal_detail jd
                 JOIN jurnal j ON jd.jurnal_id = j.id
                 WHERE jd.akun_id = ? AND jd.tenant_id = ?`;
      const params = [akun_id, tenantId];

      if (start_date) { sql += ` AND j.tanggal >= ?`; params.push(start_date); }
      if (end_date) { sql += ` AND j.tanggal <= ?`; params.push(end_date); }

      sql += ` ORDER BY j.tanggal, j.created_at`;

      const rows = db.all(sql, params);
      
      let saldo = 0;
      const detail = rows.map(row => {
        if (akun.saldo_normal === 'debit') {
          saldo += row.debit - row.kredit;
        } else {
          saldo += row.kredit - row.debit;
        }
        return { ...row, saldo_berjalan: saldo };
      });

      return successResponse(res, { akun, detail }, 'Buku besar');
    } catch (error) {
      return errorResponse(res, error.message, 500);
    }
  },

  // =================== NERACA ===================
  balanceSheet: (req, res) => {
    try {
      const tenantId = req.user.tenant_id;
      const { as_of_date } = req.query;
      const dateClause = as_of_date ? ` AND j.tanggal <= ?` : '';
      const paramsBase = as_of_date ? [as_of_date] : [];

      const getSaldo = (tipeAkun) => {
        const sql = `SELECT jd.akun_id, SUM(jd.debit) as total_debit, SUM(jd.kredit) as total_kredit
                     FROM jurnal_detail jd
                     JOIN jurnal j ON jd.jurnal_id = j.id
                     JOIN akun a ON jd.akun_id = a.id
                     WHERE a.tipe = ? AND jd.tenant_id = ? ${dateClause}
                     GROUP BY jd.akun_id`;
        return db.all(sql, [tipeAkun, tenantId, ...paramsBase]);
      };

      const aset = getSaldo('aset');
      const kewajiban = getSaldo('kewajiban');
      const ekuitas = getSaldo('ekuitas');

      const hitungTotal = (list, normal) => {
        let total = 0;
        list.forEach(item => {
          total += normal === 'debit' ? (item.total_debit - item.total_kredit) : (item.total_kredit - item.total_debit);
        });
        return total;
      };

      const totalAset = hitungTotal(aset, 'debit');
      const totalKewajiban = hitungTotal(kewajiban, 'kredit');
      const totalEkuitas = hitungTotal(ekuitas, 'kredit');

      return successResponse(res, {
        aset: { detail: aset, total: totalAset },
        kewajiban: { detail: kewajiban, total: totalKewajiban },
        ekuitas: { detail: ekuitas, total: totalEkuitas },
        keseimbangan: totalAset === totalKewajiban + totalEkuitas
      }, 'Neraca');
    } catch (error) {
      return errorResponse(res, error.message, 500);
    }
  },

  // =================== ARUS KAS ===================
  cashFlow: (req, res) => {
    try {
      const tenantId = req.user.tenant_id;
      const { start_date, end_date } = req.query;
      let sql = `SELECT * FROM kas WHERE tenant_id = ?`;
      const params = [tenantId];

      if (start_date) { sql += ` AND tanggal >= ?`; params.push(start_date); }
      if (end_date) { sql += ` AND tanggal <= ?`; params.push(end_date); }

      sql += ` ORDER BY tanggal, created_at`;

      const rows = db.all(sql, params);

      let masuk = 0, keluar = 0;
      rows.forEach(r => {
        if (r.tipe === 'masuk') masuk += r.jumlah;
        else keluar += r.jumlah;
      });

      return successResponse(res, {
        detail: rows,
        total_masuk: masuk,
        total_keluar: keluar,
        selisih: masuk - keluar
      }, 'Arus kas');
    } catch (error) {
      return errorResponse(res, error.message, 500);
    }
  },

  // =================== KARTU PIUTANG ===================
  kartuPiutang: (req, res) => {
    try {
      const tenantId = req.user.tenant_id;
      const { customer_id } = req.query;
      if (!customer_id) return errorResponse(res, 'customer_id diperlukan', 400);

      const piutang = db.all(
        `SELECT p.*, t.nomor AS trx_nomor, t.tanggal AS trx_tanggal
         FROM piutang p
         JOIN transaksi t ON p.transaksi_id = t.id
         WHERE p.customer_id = ? AND p.tenant_id = ?
         ORDER BY t.tanggal`,
        [customer_id, tenantId]
      );

      const pembayaran = db.all(
        `SELECT pp.*, p.transaksi_id
         FROM pembayaran_piutang pp
         JOIN piutang p ON pp.piutang_id = p.id
         WHERE p.customer_id = ? AND p.tenant_id = ?
         ORDER BY pp.tanggal`,
        [customer_id, tenantId]
      );

      return successResponse(res, { piutang, pembayaran }, 'Kartu piutang');
    } catch (error) {
      return errorResponse(res, error.message, 500);
    }
  },

  // =================== KARTU HUTANG ===================
  kartuHutang: (req, res) => {
    try {
      const tenantId = req.user.tenant_id;
      const { supplier_id } = req.query;
      if (!supplier_id) return errorResponse(res, 'supplier_id diperlukan', 400);

      const hutang = db.all(
        `SELECT h.*, po.nomor AS po_nomor, po.tanggal AS po_tanggal
         FROM hutang h
         JOIN purchase_order po ON h.po_id = po.id
         WHERE h.supplier_id = ? AND h.tenant_id = ?
         ORDER BY po.tanggal`,
        [supplier_id, tenantId]
      );

      const pembayaran = db.all(
        `SELECT ph.*, h.po_id
         FROM pembayaran_hutang ph
         JOIN hutang h ON ph.hutang_id = h.id
         WHERE h.supplier_id = ? AND h.tenant_id = ?
         ORDER BY ph.tanggal`,
        [supplier_id, tenantId]
      );

      return successResponse(res, { hutang, pembayaran }, 'Kartu hutang');
    } catch (error) {
      return errorResponse(res, error.message, 500);
    }
  }
};

module.exports = financeController;