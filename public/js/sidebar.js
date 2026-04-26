// ==========================================
// KONFIGURASI MENU & INISIALISASI SIDEBAR
// ==========================================

const MENU_CONFIG = [
  {
    title: 'Dashboard',
    icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>`,
    href: '/dashboard.html',
    roles: ['admin', 'kasir', 'stok']
  },
  {
    title: 'Point of Sale',
    icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>`,
    href: '/pos.html',
    roles: ['admin', 'kasir']
  },
  {
    title: 'Produk',
    icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.29 7 12 12 20.71 7"/><line x1="12" y1="22" x2="12" y2="12"/></svg>`,
    href: '/produk.html',
    roles: ['admin']
  },
  {
    title: 'Master Data',
    icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>`,
    href: '/master.html',
    roles: ['admin']
  },
  {
    title: 'Inventori',
    icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg>`,
    href: '/inventory.html',
    roles: ['admin', 'stok']
  },
  {
    title: 'Laporan',
    icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>`,
    href: '/reports.html',
    roles: ['admin']
  }
];

// ==========================================
// FUNGSI INISIALISASI SIDEBAR
// ==========================================
function initSidebar() {
  const token = localStorage.getItem('accessToken');
  if (!token) {
    window.location.href = '/index.html';
    return;
  }

  // Decode role dari token JWT
  let userRole = 'kasir';
  let userName = 'User';
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    userRole = payload.role || 'kasir';
    userName = payload.nama_lengkap || payload.email || 'User';
  } catch (e) {
    console.error('Token decode error:', e);
  }

  // Isi nama user
  const userNameEl = document.getElementById('userName');
  if (userNameEl) userNameEl.textContent = userName;

  // Toggle sidebar
  const menuToggle = document.getElementById('menuToggle');
  const sidebar = document.getElementById('sidebar');
  if (menuToggle && sidebar) {
    menuToggle.addEventListener('click', () => {
      sidebar.classList.toggle('open');
    });
    
    // Tutup sidebar saat klik di luar (mobile)
    document.addEventListener('click', (e) => {
      if (window.innerWidth <= 768 && 
          !sidebar.contains(e.target) && 
          !menuToggle.contains(e.target) &&
          sidebar.classList.contains('open')) {
        sidebar.classList.remove('open');
      }
    });
  }

  // Tandai link aktif berdasarkan halaman saat ini
  const currentPage = location.pathname.split('/').pop();
  document.querySelectorAll('.sidebar-menu a').forEach(link => {
    link.classList.remove('active');
    const href = link.getAttribute('href');
    if (href && href.includes(currentPage)) {
      link.classList.add('active');
    }
  });

  // Logout
  const btnLogout = document.getElementById('btnLogout');
  if (btnLogout) {
    btnLogout.addEventListener('click', async () => {
      const t = localStorage.getItem('accessToken');
      if (t) {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${t}` }
        }).catch(() => {});
      }
      localStorage.clear();
      window.location.href = '/index.html';
    });
  }

  // Render menu sesuai role
  const sidebarMenu = document.querySelector('.sidebar-menu');
  if (sidebarMenu) {
    const filteredMenu = MENU_CONFIG.filter(item => item.roles.includes(userRole));
    sidebarMenu.innerHTML = filteredMenu.map(item => `
      <a href="${item.href}" class="${currentPage === item.href.replace('/','') ? 'active' : ''}">
        ${item.icon}
        ${item.title}
      </a>
    `).join('');
  }
}

// ==========================================
// EXPORT UNTUK AKSES GLOBAL
// ==========================================
window.initSidebar = initSidebar;
window.MENU_CONFIG = MENU_CONFIG;