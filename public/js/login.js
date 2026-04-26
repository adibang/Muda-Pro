// ==========================================
// LOGIN SCRIPT – MUDA PRO
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('loginForm');
  const emailInput = document.getElementById('email');
  const passwordInput = document.getElementById('password');
  const submitBtn = document.getElementById('submitBtn');
  const errorBox = document.getElementById('errorMessage');

  const API_BASE = '/api';

  // Cek apakah ada pesan dari redirect (sesi habis)
  const params = new URLSearchParams(window.location.search);
  if (params.get('session') === 'expired') {
    errorBox.textContent = 'Sesi Anda telah berakhir. Silakan login kembali.';
  }

  // Jika sudah ada token, langsung ke dashboard
  if (localStorage.getItem('accessToken')) {
    window.location.href = '/dashboard.html';
    return;
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = emailInput.value.trim();
    const password = passwordInput.value;

    if (!email || !password) {
      errorBox.textContent = 'Email dan password harus diisi';
      return;
    }

    setLoading(true);
    errorBox.textContent = '';

    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data = await res.json();

      if (!res.ok || data.status !== 'success') {
        throw new Error(data.message || 'Login gagal');
      }

      localStorage.setItem('accessToken', data.data.accessToken);
      localStorage.setItem('refreshToken', data.data.refreshToken);
      window.location.href = '/dashboard.html';

    } catch (err) {
      errorBox.textContent = err.message;
    } finally {
      setLoading(false);
    }
  });

  function setLoading(loading) {
    if (loading) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span class="spinner"></span> Masuk...';
    } else {
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<i class="ph ph-sign-in"></i> Masuk';
    }
  }

  emailInput.focus();
});