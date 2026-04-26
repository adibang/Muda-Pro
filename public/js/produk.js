document.addEventListener('DOMContentLoaded', () => {
  const token = localStorage.getItem('accessToken');
  if (!token) { window.location.href = '/index.html'; return; }

  const API = '/api';
  let currentProdukId = null;

  // Fetch wrapper
  async function fetchAPI(url, options = {}) {
    const t = localStorage.getItem('accessToken');
    if (!t) { window.location.href = '/index.html'; return null; }
    try {
      const res = await fetch(url, { ...options, headers: { ...options.headers, 'Authorization': `Bearer ${t}` } });
      if (res.status === 401 || res.status === 403) { localStorage.clear(); window.location.href = '/index.html?session=expired'; return null; }
      return res;
    } catch (err) { console.error(err); return null; }
  }

  // Load kategori untuk dropdown
  async function loadKategori() {
    const res = await fetchAPI('/api/kategori');
    if (!res) return;
    const data = await res.json();
    if (data.status === 'success') {
      const sel = document.getElementById('kategoriSelect');
      sel.innerHTML = '<option value="">-- Pilih --</option>' + data.data.map(k => `<option value="${k.id}">${k.nama}</option>`).join('');
    }
  }
  loadKategori();

  // Tampilkan daftar produk
  async function loadProducts() {
    const res = await fetchAPI('/api/produk');
    if (!res) return;
    const data = await res.json();
    if (data.status === 'success') {
      const tbody = document.getElementById('productTableBody');
      tbody.innerHTML = data.data.map(p => `
        <tr>
          <td>${p.kode || '-'}</td>
          <td>${p.nama}</td>
          <td>Rp ${Number(p.harga_jual).toLocaleString()}</td>
          <td>${p.stok_awal || 0}</td>
          <td>
            <button class="btn-sm" data-edit="${p.id}">Edit</button>
            <button class="btn-sm" data-varian="${p.id}">Varian</button>
            <button class="btn-sm warning" data-harga="${p.id}">Harga</button>
            <button class="btn-sm danger" data-delete="${p.id}">Hapus</button>
          </td>
        </tr>
      `).join('');

      // Bind events
      document.querySelectorAll('[data-edit]').forEach(btn => btn.addEventListener('click', () => editProduct(btn.dataset.edit)));
      document.querySelectorAll('[data-varian]').forEach(btn => btn.addEventListener('click', () => openVarian(btn.dataset.varian)));
      document.querySelectorAll('[data-harga]').forEach(btn => btn.addEventListener('click', () => openHarga(btn.dataset.harga)));
      document.querySelectorAll('[data-delete]').forEach(btn => btn.addEventListener('click', () => deleteProduct(btn.dataset.delete)));
    }
  }

  // Tambah / Edit Produk
  document.getElementById('btnAddProduct').addEventListener('click', () => {
    document.getElementById('productModalTitle').textContent = 'Tambah Produk';
    document.getElementById('productForm').reset();
    currentProdukId = null;
    document.getElementById('productModal').classList.add('active');
  });

  document.getElementById('btnCancelProduct').addEventListener('click', () => {
    document.getElementById('productModal').classList.remove('active');
  });

  document.getElementById('productForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const payload = Object.fromEntries(formData.entries());
    payload.harga_dasar = parseFloat(payload.harga_dasar) || 0;
    payload.harga_jual = parseFloat(payload.harga_jual);
    payload.berat = parseFloat(payload.berat) || 0;
    payload.diskon = parseFloat(payload.diskon) || 0;
    payload.stok_minimal = parseInt(payload.stok_minimal) || 0;
    payload.kategori_id = payload.kategori_id ? parseInt(payload.kategori_id) : null;

    const url = currentProdukId ? `/api/produk/${currentProdukId}` : '/api/produk';
    const method = currentProdukId ? 'PUT' : 'POST';
    const res = await fetchAPI(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    if (!res) return;
    const data = await res.json();
    if (data.status === 'success') {
      alert('Produk disimpan');
      document.getElementById('productModal').classList.remove('active');
      loadProducts();
    } else {
      alert(data.message || 'Gagal menyimpan produk');
    }
  });

  async function editProduct(id) {
    const res = await fetchAPI(`/api/produk/${id}`);
    if (!res) return;
    const data = await res.json();
    if (data.status === 'success') {
      const p = data.data;
      document.getElementById('productModalTitle').textContent = 'Edit Produk';
      currentProdukId = p.id;
      document.querySelector('#productForm [name="kode"]').value = p.kode || '';
      document.querySelector('#productForm [name="nama"]').value = p.nama || '';
      document.querySelector('#productForm [name="barcode"]').value = p.barcode || '';
      document.querySelector('#productForm [name="harga_dasar"]').value = p.harga_dasar || 0;
      document.querySelector('#productForm [name="harga_jual"]').value = p.harga_jual || 0;
      document.querySelector('#productForm [name="berat"]').value = p.berat || 0;
      document.querySelector('#productForm [name="diskon"]').value = p.diskon || 0;
      document.querySelector('#productForm [name="stok_minimal"]').value = p.stok_minimal || 0;
      document.querySelector('#productForm [name="kategori_id"]').value = p.kategori_id || '';
      document.getElementById('productModal').classList.add('active');
    }
  }

  async function deleteProduct(id) {
    if (!confirm('Hapus produk ini?')) return;
    const res = await fetchAPI(`/api/produk/${id}`, { method: 'DELETE' });
    if (!res) return;
    const data = await res.json();
    if (data.status === 'success') {
      loadProducts();
    } else {
      alert(data.message || 'Gagal menghapus');
    }
  }

  // ============ VARIAN & SATUAN ============
  async function openVarian(produkId) {
    currentProdukId = produkId;
    const modal = document.getElementById('varianModal');
    const content = document.getElementById('varianContent');
    // Ambil varian dan satuan produk
    const res = await fetchAPI(`/api/produk/${produkId}`);
    if (!res) return;
    const data = await res.json();
    if (data.status !== 'success') return;
    const produk = data.data;
    let html = `<h4>Varian Produk: ${produk.nama}</h4>`;
    html += `<div style="margin:1rem 0;"><button class="btn-sm" id="btnAddVarian">+ Tambah Varian</button></div>`;
    html += `<table><thead><tr><th>Nama Varian</th><th>Barcode</th><th>Harga Jual</th><th>Stok</th><th>Aksi</th></tr></thead><tbody id="varianTableBody"></tbody></table>`;

    html += `<h4 style="margin-top:2rem;">Konversi Satuan</h4>`;
    html += `<div style="margin:1rem 0;"><button class="btn-sm" id="btnAddSatuan">+ Tambah Satuan</button></div>`;
    html += `<table><thead><tr><th>Satuan</th><th>Barcode</th><th>Faktor Konversi</th><th>Harga Jual</th><th>Default</th><th>Aksi</th></tr></thead><tbody id="satuanTableBody"></tbody></table>`;
    content.innerHTML = html;
    modal.classList.add('active');

    // Load varian
    async function loadVarian() {
      const vRes = await fetchAPI(`/api/produk/${produkId}/varian`);
      if (!vRes) return;
      const vData = await vRes.json();
      if (vData.status === 'success') {
        document.getElementById('varianTableBody').innerHTML = vData.data.map(v => `
          <tr>
            <td>${v.nama_varian}</td>
            <td>${v.barcode || '-'}</td>
            <td>${v.harga_jual}</td>
            <td>${v.stok}</td>
            <td>
              <button class="btn-sm" data-edit-v="${v.id}">Edit</button>
              <button class="btn-sm danger" data-del-v="${v.id}">Hapus</button>
            </td>
          </tr>
        `).join('');
        document.querySelectorAll('[data-edit-v]').forEach(b => b.addEventListener('click', () => editVarian(b.dataset.editV)));
        document.querySelectorAll('[data-del-v]').forEach(b => b.addEventListener('click', () => deleteVarian(b.dataset.delV)));
      }
    }
    // Load satuan
    async function loadSatuan() {
      const sRes = await fetchAPI(`/api/produk/${produkId}/satuan`);
      if (!sRes) return;
      const sData = await sRes.json();
      if (sData.status === 'success') {
        document.getElementById('satuanTableBody').innerHTML = sData.data.map(s => `
          <tr>
            <td>${s.satuan_nama || s.satuan_id}</td>
            <td>${s.barcode || '-'}</td>
            <td>${s.faktor_konversi}</td>
            <td>${s.harga_jual || '-'}</td>
            <td>${s.is_default ? 'Ya' : 'Tidak'}</td>
            <td>
              <button class="btn-sm" data-edit-s="${s.id}">Edit</button>
              <button class="btn-sm danger" data-del-s="${s.id}">Hapus</button>
            </td>
          </tr>
        `).join('');
        document.querySelectorAll('[data-edit-s]').forEach(b => b.addEventListener('click', () => editSatuan(b.dataset.editS)));
        document.querySelectorAll('[data-del-s]').forEach(b => b.addEventListener('click', () => deleteSatuan(b.dataset.delS)));
      }
    }

    await loadVarian();
    await loadSatuan();

    // Tambah varian
    document.getElementById('btnAddVarian').addEventListener('click', async () => {
      const nama = prompt('Nama varian:');
      if (!nama) return;
      const barcode = prompt('Barcode (opsional):');
      const harga = prompt('Harga jual (opsional):');
      const stok = prompt('Stok (0):');
      const body = { nama_varian: nama, barcode, harga_jual: parseFloat(harga) || undefined, stok: parseInt(stok) || 0 };
      const res = await fetchAPI(`/api/produk/${produkId}/varian`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!res) return;
      const d = await res.json();
      if (d.status === 'success') loadVarian();
      else alert(d.message);
    });

    // Tambah satuan
    document.getElementById('btnAddSatuan').addEventListener('click', async () => {
      // ambil daftar satuan dari API
      const satRes = await fetchAPI('/api/satuan');
      if (!satRes) return;
      const satData = await satRes.json();
      if (satData.status !== 'success') return;
      const satuanList = satData.data;
      const satuanId = prompt('Pilih ID Satuan:\n' + satuanList.map(s => `${s.id}: ${s.nama}`).join('\n'));
      if (!satuanId) return;
      const faktor = prompt('Faktor konversi ke satuan dasar:');
      const barcode = prompt('Barcode untuk satuan ini (opsional):');
      const harga = prompt('Harga jual untuk satuan ini (opsional):');
      const isDefault = confirm('Jadikan satuan default?');
      const body = {
        satuan_id: parseInt(satuanId),
        faktor_konversi: parseFloat(faktor),
        barcode,
        harga_jual: parseFloat(harga) || undefined,
        is_default: isDefault ? 1 : 0
      };
      const res = await fetchAPI(`/api/produk/${produkId}/satuan`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!res) return;
      const d = await res.json();
      if (d.status === 'success') loadSatuan();
      else alert(d.message);
    });

    // Close
    document.getElementById('btnCloseVarian').addEventListener('click', () => modal.classList.remove('active'));
  }

  // ============ HARGA BERTINGKAT ============
  async function openHarga(produkId) {
    currentProdukId = produkId;
    const modal = document.getElementById('hargaModal');
    const content = document.getElementById('hargaContent');
    const res = await fetchAPI(`/api/produk/${produkId}/harga-bertingkat`);
    if (!res) return;
    const data = await res.json();
    if (data.status !== 'success') return;
    content.innerHTML = `
      <div style="margin:1rem 0;"><button class="btn-sm" id="btnAddHarga">+ Tambah Level Harga</button></div>
      <table><thead><tr><th>Min Qty</th><th>Max Qty</th><th>Harga</th><th>Aksi</th></tr></thead>
      <tbody>${data.data.map(h => `
        <tr>
          <td>${h.min_qty}</td><td>${h.max_qty || '~'}</td><td>${h.harga}</td>
          <td><button class="btn-sm danger" data-del-h="${h.id}">Hapus</button></td>
        </tr>
      `).join('')}</tbody>
    `;
    modal.classList.add('active');

    document.getElementById('btnAddHarga').addEventListener('click', async () => {
      const min = prompt('Minimal kuantitas:');
      const max = prompt('Maksimal kuantitas (kosongkan jika tidak terbatas):');
      const harga = prompt('Harga:');
      const body = { min_qty: parseInt(min), max_qty: max ? parseInt(max) : null, harga: parseFloat(harga) };
      const res = await fetchAPI(`/api/produk/${produkId}/harga-bertingkat`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!res) return;
      const d = await res.json();
      if (d.status === 'success') openHarga(produkId); // reload
      else alert(d.message);
    });

    document.querySelectorAll('[data-del-h]').forEach(b => b.addEventListener('click', async () => {
      if (!confirm('Hapus level harga?')) return;
      const id = b.dataset.delH;
      const res = await fetchAPI(`/api/produk/harga-bertingkat/${id}`, { method: 'DELETE' });
      if (!res) return;
      const d = await res.json();
      if (d.status === 'success') openHarga(produkId);
      else alert(d.message);
    }));

    document.getElementById('btnCloseHarga').addEventListener('click', () => modal.classList.remove('active'));
  }

  // Fungsi edit/hapus varian & satuan (singkat, prompt)
  async function editVarian(id) {
    const res = await fetchAPI(`/api/varian/${id}`);
    if (!res) return;
    const v = await res.json();
    if (v.status !== 'success') return;
    const nama = prompt('Nama varian:', v.data.nama_varian);
    const barcode = prompt('Barcode:', v.data.barcode);
    const harga = prompt('Harga jual:', v.data.harga_jual);
    const stok = prompt('Stok:', v.data.stok);
    const body = { nama_varian: nama, barcode, harga_jual: parseFloat(harga), stok: parseInt(stok) };
    const putRes = await fetchAPI(`/api/varian/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!putRes) return;
    const d = await putRes.json();
    if (d.status === 'success') location.reload();
    else alert(d.message);
  }
  async function deleteVarian(id) {
    if (!confirm('Hapus varian?')) return;
    const res = await fetchAPI(`/api/varian/${id}`, { method: 'DELETE' });
    if (!res) return;
    const d = await res.json();
    if (d.status === 'success') location.reload();
    else alert(d.message);
  }
  async function editSatuan(id) {
    alert('Edit satuan via prompt belum tersedia, gunakan API langsung.');
  }
  async function deleteSatuan(id) {
    if (!confirm('Hapus satuan?')) return;
    const res = await fetchAPI(`/api/produk-satuan/${id}`, { method: 'DELETE' });
    if (!res) return;
    const d = await res.json();
    if (d.status === 'success') location.reload();
    else alert(d.message);
  }

  // Close modal overlay ketika klik luar
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.classList.remove('active'); });
  });

  loadProducts();
});