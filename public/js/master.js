document.addEventListener('DOMContentLoaded', () => {
  const token = localStorage.getItem('accessToken');
  if (!token) {
    window.location.href = '/index.html';
    return;
  }

  const API = '/api';

  // Konfigurasi endpoint per tab
  const config = {
    kategori: {
      endpoint: '/api/kategori',
      fields: ['nama'],
      columns: ['Nama'],
      title: 'Kategori'
    },
    satuan: {
      endpoint: '/api/satuan',
      fields: ['nama'],
      columns: ['Nama'],
      title: 'Satuan'
    },
    gudang: {
      endpoint: '/api/gudang',
      fields: ['kode', 'nama', 'lokasi', 'kapasitas'],
      columns: ['Kode', 'Nama', 'Lokasi', 'Kapasitas'],
      title: 'Gudang'
    },
    customer: {
      endpoint: '/api/customer',
      fields: ['kode', 'nama', 'kontak'],
      columns: ['Kode', 'Nama', 'Kontak'],
      title: 'Customer'
    },
    supplier: {
      endpoint: '/api/supplier',
      fields: ['kode', 'nama', 'kontak'],
      columns: ['Kode', 'Nama', 'Kontak'],
      title: 'Supplier'
    }
  };

  let currentTab = 'kategori';
  let editId = null;

  // UI elements
  const tableHead = document.getElementById('tableHead');
  const tableBody = document.getElementById('tableBody');
  const tabTitle = document.getElementById('tabTitle');
  const modalOverlay = document.getElementById('modalOverlay');
  const modalTitle = document.getElementById('modalTitle');
  const modalFields = document.getElementById('modalFields');
  const modalForm = document.getElementById('modalForm');
  const btnAdd = document.getElementById('btnAdd');
  const btnCancel = document.getElementById('btnCancel');
  const userName = document.getElementById('userName');
  const menuToggle = document.getElementById('menuToggle');
  const sidebar = document.getElementById('sidebar');
  const btnLogout = document.getElementById('btnLogout');
  const tabBtns = document.querySelectorAll('.tab-btn');

  // ===== FETCH WRAPPER =====
  async function fetchAPI(url, options = {}) {
    const currentToken = localStorage.getItem('accessToken');
    if (!currentToken) {
      window.location.href = '/index.html';
      return null;
    }
    try {
      const res = await fetch(url, {
        ...options,
        headers: {
          ...options.headers,
          'Authorization': `Bearer ${currentToken}`
        }
      });
      if (res.status === 401 || res.status === 403) {
        localStorage.clear();
        window.location.href = '/index.html?session=expired';
        return null;
      }
      return res;
    } catch (err) {
      console.error('Fetch error:', err);
      return null;
    }
  }

  // ===== RENDER TABEL =====
  async function loadTable() {
    const cfg = config[currentTab];
    tabTitle.textContent = cfg.title;

    // Render head
    tableHead.innerHTML = cfg.columns.map(c => `<th>${c}</th>`).join('') + '<th>Aksi</th>';

    const res = await fetchAPI(cfg.endpoint);
    if (!res) {
      tableBody.innerHTML = '<tr><td colspan="'+(cfg.columns.length+1)+'">Gagal memuat data</td></tr>';
      return;
    }

    const data = await res.json();
    if (data.status !== 'success') {
      tableBody.innerHTML = '<tr><td colspan="'+(cfg.columns.length+1)+'">'+data.message+'</td></tr>';
      return;
    }

    const items = data.data || [];
    tableBody.innerHTML = items.map(item => {
      const values = cfg.fields.map(f => item[f] !== undefined ? item[f] : '-');
      return `<tr>
        ${values.map(v => `<td>${v}</td>`).join('')}
        <td>
          <button class="btn-edit" data-id="${item.id}">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button class="btn-delete" data-id="${item.id}">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          </button>
        </td>
      </tr>`;
    }).join('');

    // Bind edit & delete
    document.querySelectorAll('.btn-edit').forEach(btn => {
      btn.addEventListener('click', () => editItem(btn.dataset.id));
    });
    document.querySelectorAll('.btn-delete').forEach(btn => {
      btn.addEventListener('click', () => deleteItem(btn.dataset.id));
    });
  }

  // ===== MODAL =====
  function openModal(title, data = {}) {
    modalTitle.textContent = title;
    const cfg = config[currentTab];
    modalFields.innerHTML = cfg.fields.map(f => `
      <div class="form-group">
        <label>${f.charAt(0).toUpperCase() + f.slice(1)}</label>
        <input name="${f}" value="${data[f] || ''}" required>
      </div>
    `).join('');
    editId = data.id || null;
    modalOverlay.classList.add('active');
  }

  function closeModal() {
    modalOverlay.classList.remove('active');
    editId = null;
  }

  btnAdd.addEventListener('click', () => openModal('Tambah ' + config[currentTab].title));

  btnCancel.addEventListener('click', closeModal);
  modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) closeModal();
  });

  modalForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(modalForm);
    const payload = {};
    formData.forEach((value, key) => { payload[key] = value; });

    const cfg = config[currentTab];
    const url = editId ? `${cfg.endpoint}/${editId}` : cfg.endpoint;
    const method = editId ? 'PUT' : 'POST';

    const res = await fetchAPI(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res) return;
    const result = await res.json();
    if (result.status === 'success') {
      closeModal();
      loadTable();
    } else {
      alert(result.message || 'Gagal menyimpan');
    }
  });

  async function editItem(id) {
    const cfg = config[currentTab];
    const res = await fetchAPI(`${cfg.endpoint}/${id}`);
    if (!res) return;
    const data = await res.json();
    if (data.status === 'success') {
      openModal('Edit ' + cfg.title, data.data);
    }
  }

  async function deleteItem(id) {
    if (!confirm('Hapus data ini?')) return;
    const cfg = config[currentTab];
    const res = await fetchAPI(`${cfg.endpoint}/${id}`, { method: 'DELETE' });
    if (!res) return;
    const result = await res.json();
    if (result.status === 'success') {
      loadTable();
    } else {
      alert(result.message || 'Gagal menghapus');
    }
  }

  // ===== TAB NAVIGATION =====
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      tabBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentTab = btn.dataset.tab;
      loadTable();
    });
  });

  // ===== SIDEBAR & LOGOUT =====
  menuToggle.addEventListener('click', () => sidebar.classList.toggle('open'));
  document.addEventListener('click', (e) => {
    if (window.innerWidth <= 768 && !sidebar.contains(e.target) && !menuToggle.contains(e.target)) {
      sidebar.classList.remove('open');
    }
  });

  btnLogout.addEventListener('click', async () => {
    const currentToken = localStorage.getItem('accessToken');
    if (currentToken) {
      await fetch(`${API}/auth/logout`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${currentToken}` }
      }).catch(() => {});
    }
    localStorage.clear();
    window.location.href = '/index.html';
  });

  // ===== INIT =====
  try {
    const t = localStorage.getItem('accessToken');
    const payload = JSON.parse(atob(t.split('.')[1]));
    userName.textContent = payload.nama_lengkap || payload.email || 'User';
  } catch (e) {
    userName.textContent = 'User';
  }

  loadTable();
});