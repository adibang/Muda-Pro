// Fungsi utama dipanggil setelah sidebar siap
function loadDashboardData() {
  const API = '/api';

  async function fetchAPI(url, options = {}) {
    const t = localStorage.getItem('accessToken');
    if (!t) { window.location.href = '/index.html'; return null; }
    try {
      const res = await fetch(url, { ...options, headers: { ...options.headers, 'Authorization': `Bearer ${t}` } });
      if (res.status === 401 || res.status === 403) { localStorage.clear(); window.location.href = '/index.html?session=expired'; return null; }
      return res;
    } catch (err) { console.error(err); return null; }
  }

  async function loadStock() {
    const res = await fetchAPI(`${API}/inventory/stock`);
    if (!res) return;
    const data = await res.json();
    if (data.status === 'success') {
      const items = data.data || [];
      let total = 0, low = 0;
      const lowItems = [];
      items.forEach(item => {
        total += item.stok;
        if (item.stok <= 10) {
          low++;
          lowItems.push({ nama: item.produk_nama + (item.nama_varian ? ' - ' + item.nama_varian : ''), gudang: item.gudang_nama || '-', stok: item.stok });
        }
      });
      document.getElementById('totalStok').textContent = total;
      document.getElementById('stokRendah').textContent = low;
      const tbody = document.getElementById('lowStockTable');
      tbody.innerHTML = lowItems.length ? lowItems.map(i => `<tr><td>${i.nama}</td><td>${i.gudang}</td><td>${i.stok}</td></tr>`).join('') : '<tr><td colspan="3">Semua stok aman</td></tr>';
    }
  }

  async function loadSales() {
    const today = new Date().toISOString().slice(0,10);
    const res = await fetchAPI(`${API}/sales?start_date=${today}&end_date=${today}`);
    if (!res) return;
    const data = await res.json();
    if (data.status === 'success') {
      const transactions = data.data || [];
      document.getElementById('penjualanHariIni').textContent = transactions.length;
      const tbody = document.getElementById('recentSalesTable');
      const recent = transactions.slice(0,5);
      tbody.innerHTML = recent.length ? recent.map(t => `<tr><td>${t.nomor}</td><td>${t.tanggal}</td><td>${t.customer_nama || '-'}</td><td>Rp ${Number(t.total_akhir).toLocaleString()}</td></tr>`).join('') : '<tr><td colspan="4">Belum ada transaksi</td></tr>';
    }
  }

  loadStock();
  loadSales();
}