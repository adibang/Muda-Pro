const { db } = require('../config/database');
const { successResponse, errorResponse } = require('../utils/response');

const reportController = {
  // ==================== LAPORAN PENJUALAN ====================
  salesReport: (req, res) => {
    try {
      const tenantId = req.user.tenant_id;
      const { start_date, end_date, customer_id, gudang_id } = req.query;
      let sql = `SELECT t.*, c.nama AS customer_nama, g.nama AS gudang_nama, u.nama_lengkap AS kasir_nama
                 FROM transaksi t
                 LEFT JOIN customer c ON t.customer_id = c.id
                 LEFT JOIN gudang g ON t.gudang_id = g.id
                 LEFT JOIN users u ON t.user_id = u.id
                 WHERE t.tenant_id = ? AND t.deleted = 0`;
      const params = [tenantId];

      if (start_date) { sql += ` AND t.tanggal >= ?`; params.push(start_date); }
      if (end_date) { sql += ` AND t.tanggal <= ?`; params.push(end_date); }
      if (customer_id) { sql += ` AND t.customer_id = ?`; params.push(customer_id); }
      if (gudang_id) { sql += ` AND t.gudang_id = ?`; params.push(gudang_id); }

      sql += ` ORDER BY t.tanggal DESC, t.created_at DESC`;

      const rows = db.all(sql, params);
      let totalTransaksi = rows.length;
      let totalPendapatan = 0;
      rows.forEach(r => { totalPendapatan += r.total_akhir; });

      const ringkasan = {
        total_transaksi: totalTransaksi,
        total_pendapatan: totalPendapatan,
        rata_rata_per_transaksi: totalTransaksi > 0 ? totalPendapatan / totalTransaksi : 0
      };

      return successResponse(res, { ringkasan, detail: rows }, 'Laporan penjualan');
    } catch (error) {
      return errorResponse(res, error.message, 500);
    }
  },

  // ==================== LAPORAN LABA/RUGI ====================
  profitLossReport: (req, res) => {
    try {
      const tenantId = req.user.tenant_id;
      const { start_date, end_date } = req.query;
      let sql = `SELECT td.produk_id, p.nama AS produk_nama, v.nama_varian,
                        SUM(td.kuantitas) AS total_qty,
                        SUM(td.subtotal) AS total_pendapatan,
                        SUM(td.kuantitas * COALESCE(p.harga_dasar, 0)) AS total_hpp,
                        SUM(td.subtotal) - SUM(td.kuantitas * COALESCE(p.harga_dasar, 0)) AS laba_kotor
                 FROM transaksi_detail td
                 JOIN transaksi t ON td.transaksi_id = t.id AND t.tenant_id = ? AND t.deleted = 0
                 LEFT JOIN produk p ON td.produk_id = p.id
                 LEFT JOIN varian_produk v ON td.varian_id = v.id
                 WHERE 1=1`;
      const params = [tenantId];

      if (start_date) { sql += ` AND t.tanggal >= ?`; params.push(start_date); }
      if (end_date) { sql += ` AND t.tanggal <= ?`; params.push(end_date); }

      sql += ` GROUP BY td.produk_id, td.varian_id ORDER BY laba_kotor DESC`;

      const rows = db.all(sql, params);
      let totalPendapatan = 0, totalHPP = 0, totalLaba = 0;
      rows.forEach(r => {
        totalPendapatan += r.total_pendapatan;
        totalHPP += r.total_hpp;
        totalLaba += r.laba_kotor;
      });

      const ringkasan = {
        total_pendapatan: totalPendapatan,
        total_hpp: totalHPP,
        total_laba_kotor: totalLaba
      };

      return successResponse(res, { ringkasan, detail: rows }, 'Laporan laba/rugi');
    } catch (error) {
      return errorResponse(res, error.message, 500);
    }
  },

  // ==================== LAPORAN STOK ====================
  stockReport: (req, res) => {
    try {
      const tenantId = req.user.tenant_id;
      const { gudang_id } = req.query;
      let sql = `SELECT sg.*, p.nama AS produk_nama, v.nama_varian, g.nama AS gudang_nama
                 FROM stok_gudang sg
                 LEFT JOIN produk p ON sg.produk_id = p.id
                 LEFT JOIN varian_produk v ON sg.varian_id = v.id
                 LEFT JOIN gudang g ON sg.gudang_id = g.id
                 WHERE sg.tenant_id = ?`;
      const params = [tenantId];

      if (gudang_id) { sql += ` AND sg.gudang_id = ?`; params.push(gudang_id); }

      sql += ` ORDER BY sg.produk_id, sg.gudang_id`;

      const rows = db.all(sql, params);
      let totalStok = 0;
      rows.forEach(r => { totalStok += r.stok; });

      return successResponse(res, {
        ringkasan: { total_stok: totalStok, total_item: rows.length },
        detail: rows
      }, 'Laporan stok');
    } catch (error) {
      return errorResponse(res, error.message, 500);
    }
  },

  // ==================== LAPORAN PEMBELIAN ====================
  purchaseReport: (req, res) => {
    try {
      const tenantId = req.user.tenant_id;
      const { start_date, end_date, supplier_id } = req.query;
      let sql = `SELECT po.*, s.nama AS supplier_nama
                 FROM purchase_order po
                 LEFT JOIN supplier s ON po.supplier_id = s.id
                 WHERE po.tenant_id = ?`;
      const params = [tenantId];

      if (start_date) { sql += ` AND po.tanggal >= ?`; params.push(start_date); }
      if (end_date) { sql += ` AND po.tanggal <= ?`; params.push(end_date); }
      if (supplier_id) { sql += ` AND po.supplier_id = ?`; params.push(supplier_id); }

      sql += ` ORDER BY po.tanggal DESC`;

      const rows = db.all(sql, params);
      let totalPembelian = 0;
      rows.forEach(r => { totalPembelian += r.total; });

      return successResponse(res, {
        ringkasan: { total_po: rows.length, total_nilai: totalPembelian },
        detail: rows
      }, 'Laporan pembelian');
    } catch (error) {
      return errorResponse(res, error.message, 500);
    }
  },

  // ==================== LAPORAN MUTASI STOK ====================
  mutationReport: (req, res) => {
    try {
      const tenantId = req.user.tenant_id;
      const { start_date, end_date, tipe, produk_id, gudang_id } = req.query;
      let sql = `SELECT m.*, p.nama AS produk_nama, v.nama_varian, g.nama AS gudang_nama
                 FROM mutasi_stok m
                 LEFT JOIN produk p ON m.produk_id = p.id
                 LEFT JOIN varian_produk v ON m.varian_id = v.id
                 LEFT JOIN gudang g ON m.gudang_id = g.id
                 WHERE m.tenant_id = ?`;
      const params = [tenantId];

      if (start_date) { sql += ` AND m.tanggal >= ?`; params.push(start_date); }
      if (end_date) { sql += ` AND m.tanggal <= ?`; params.push(end_date); }
      if (tipe) { sql += ` AND m.tipe = ?`; params.push(tipe); }
      if (produk_id) { sql += ` AND m.produk_id = ?`; params.push(produk_id); }
      if (gudang_id) { sql += ` AND m.gudang_id = ?`; params.push(gudang_id); }

      sql += ` ORDER BY m.created_at DESC LIMIT 500`;

      const rows = db.all(sql, params);
      return successResponse(res, rows, 'Laporan mutasi stok');
    } catch (error) {
      return errorResponse(res, error.message, 500);
    }
  }
};

module.exports = reportController;