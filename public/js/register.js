document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('registerForm');
  const submitBtn = document.getElementById('submitBtn');
  const errorBox = document.getElementById('errorMessage');
  const API_BASE = '/api';

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const nama = document.getElementById('nama').value.trim();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;

    if (!nama || !email || !password) {
      errorBox.textContent = 'Semua field wajib diisi';
      return;
    }

    setLoading(true);
    errorBox.textContent = '';

    try {
      const res = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nama_lengkap: nama, email, password })
      });

      const data = await res.json();
      if (!res.ok || data.status !== 'success') {
        throw new Error(data.message || 'Pendaftaran gagal');
      }

      window.location.href = '/index.html?register=success';
    } catch (err) {
      errorBox.textContent = err.message;
    } finally {
      setLoading(false);
    }
  });

  function setLoading(loading) {
    if (loading) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span class="spinner"></span> Mendaftar...';
    } else {
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<i class="ph ph-user-plus"></i> Daftar';
    }
  }
});