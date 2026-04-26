document.addEventListener('DOMContentLoaded', () => {
  const token = localStorage.getItem('accessToken');
  if (!token) { window.location.href = '/index.html'; return; }

  const API = '/api';
  let cart = [];
  let products = [];

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

  // Load produk
  async function loadProducts() {
    const res = await fetchAPI('/api/produk');
    if (!res) return;
    const data = await res.json();
    if (data.status === 'success') {
      products = data.data || [];
      renderProducts(products);
    }
  }

  function renderProducts(list) {
    const grid = document.getElementById('productGrid');
    grid.innerHTML = list.map(p => `
      <div class="product-card" data-id="${p.id}" data-nama="${p.nama}" data-harga="${p.harga_jual}">
        <div class="product-name">${p.nama}</div>
        <div class="product-price">Rp ${Number(p.harga_jual).toLocaleString()}</div>
      </div>
    `).join('');
    document.querySelectorAll('.product-card').forEach(card => {
      card.addEventListener('click', () => {
        const id = card.dataset.id;
        const nama = card.dataset.nama;
        const harga = parseFloat(card.dataset.harga);
        addToCart({ id, nama, harga });
      });
    });
  }

  function addToCart(product) {
    const existing = cart.find(item => item.id === product.id);
    if (existing) {
      existing.qty += 1;
    } else {
      cart.push({ ...product, qty: 1 });
    }
    renderCart();
  }

  function removeFromCart(id) {
    cart = cart.filter(item => item.id !== id);
    renderCart();
  }

  function renderCart() {
    const container = document.getElementById('cartItems');
    if (cart.length === 0) {
      container.innerHTML = '<p style="color:var(--mood-500);text-align:center;">Belum ada item</p>';
    } else {
      container.innerHTML = cart.map(item => `
        <div class="cart-item">
          <div class="item-info">
            <div>${item.nama}</div>
            <div style="font-size:0.8rem;color:var(--mood-500);">Rp ${item.harga.toLocaleString()}</div>
          </div>
          <div class="item-qty">
            <input type="number" value="${item.qty}" min="1" data-id="${item.id}" class="qty-input">
          </div>
          <div style="margin-left:0.5rem;">Rp ${(item.harga * item.qty).toLocaleString()}</div>
          <button class="btn-delete" data-id="${item.id}" style="margin-left:0.25rem;">✕</button>
        </div>
      `).join('');

      // Event qty change
      document.querySelectorAll('.qty-input').forEach(input => {
        input.addEventListener('change', (e) => {
          const id = e.target.dataset.id;
          const item = cart.find(i => i.id === id);
          if (item) {
            item.qty = parseInt(e.target.value) || 1;
            renderCart();
          }
        });
      });

      // Event delete
      document.querySelectorAll('.btn-delete').forEach(btn => {
        btn.addEventListener('click', () => removeFromCart(btn.dataset.id));
      });
    }
    updateSummary();
  }

  function updateSummary() {
    const subtotal = cart.reduce((sum, item) => sum + item.harga * item.qty, 0);
    const diskonPersen = parseFloat(document.getElementById('diskonPersen').value) || 0;
    const pajakPersen = parseFloat(document.getElementById('pajakPersen').value) || 0;
    const totalSetelahDiskon = subtotal - (subtotal * diskonPersen / 100);
    const total = totalSetelahDiskon + (totalSetelahDiskon * pajakPersen / 100);

    document.getElementById('subtotal').textContent = `Rp ${subtotal.toLocaleString()}`;
    document.getElementById('totalAkhir').textContent = `Rp ${total.toLocaleString()}`;
  }

  document.getElementById('diskonPersen').addEventListener('input', updateSummary);
  document.getElementById('pajakPersen').addEventListener('input', updateSummary);

  // Search
  document.getElementById('searchInput').addEventListener('input', (e) => {
    const keyword = e.target.value.toLowerCase();
    const filtered = products.filter(p => p.nama.toLowerCase().includes(keyword) || (p.barcode && p.barcode.includes(keyword)));
    renderProducts(filtered);
  });

  // Bayar
  document.getElementById('btnPay').addEventListener('click', () => {
    if (cart.length === 0) return alert('Keranjang kosong');
    const totalText = document.getElementById('totalAkhir').textContent;
    document.getElementById('bayarTotal').textContent = totalText;
    document.getElementById('modalBayar').classList.add('active');
  });

  document.getElementById('btnCancelBayar').addEventListener('click', () => {
    document.getElementById('modalBayar').classList.remove('active');
  });

  document.getElementById('inputDibayar').addEventListener('input', (e) => {
    const total = parseFloat(document.getElementById('totalAkhir').textContent.replace(/[^\d]/g, '')) || 0;
    const dibayar = parseFloat(e.target.value) || 0;
    const kembalian = dibayar - total;
    document.getElementById('kembalianText').textContent = kembalian >= 0 ? `Kembalian: Rp ${kembalian.toLocaleString()}` : 'Pembayaran kurang';
  });

  document.getElementById('btnConfirmBayar').addEventListener('click', async () => {
    const total = parseFloat(document.getElementById('totalAkhir').textContent.replace(/[^\d]/g, '')) || 0;
    const dibayar = parseFloat(document.getElementById('inputDibayar').value) || 0;
    if (dibayar < total) return alert('Pembayaran kurang');

    const diskon = document.getElementById('diskonPersen').value || 0;
    const pajak = document.getElementById('pajakPersen').value || 0;
    const items = cart.map(item => ({
      produk_id: item.id,
      kuantitas: item.qty
    }));

    const res = await fetchAPI('/api/sales', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items,
        diskon_persen: parseFloat(diskon),
        pajak_persen: parseFloat(pajak),
        dibayar,
        metode_pembayaran: 'tunai'
      })
    });

    if (!res) return;
    const data = await res.json();
    if (data.status === 'success') {
      alert('Transaksi berhasil!\nNomor: ' + data.data.nomor);
      cart = [];
      renderCart();
      document.getElementById('modalBayar').classList.remove('active');
      document.getElementById('inputDibayar').value = '';
      document.getElementById('diskonPersen').value = 0;
      document.getElementById('pajakPersen').value = 0;
    } else {
      alert(data.message || 'Transaksi gagal');
    }
  });

  // Modal click outside
  document.getElementById('modalBayar').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) e.currentTarget.classList.remove('active');
  });

  // Init
  loadProducts();
});