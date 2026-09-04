import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { ROLE_DEFAULT_ROUTES } from '../../constants';

// All demo accounts — click a row to auto-fill
const DEMO_ACCOUNTS = [
  // ── Yönetim ──────────────────────────────────────────────────────────────
  { name: 'Sistem Yöneticisi',   email: 'admin@example.com',          password: 'admin123', role: 'Sistem Admin',      color: '#0052CC' },
  // ── BIGD — Ağ Altyapısı Yenileme ─────────────────────────────────────────
  { name: 'Ayşe Kaya',           email: 'bigd.baskan@example.com',    password: 'pass123',  role: 'Daire Başkanı',     color: '#00875A' },
  { name: 'Mehmet Demir',        email: 'bigd.pm@example.com',        password: 'pass123',  role: 'PM (Ağ Altyapısı)', color: '#FF5630' },
  { name: 'Ali Yılmaz',          email: 'bigd.worker1@example.com',   password: 'pass123',  role: 'Üye',               color: '#6554C0' },
  { name: 'Fatma Şahin',         email: 'bigd.worker2@example.com',   password: 'pass123',  role: 'Üye',               color: '#6554C0' },
  { name: 'Hasan Çelik',         email: 'bigd.worker3@example.com',   password: 'pass123',  role: 'Üye',               color: '#6554C0' },
  { name: 'Elif Arslan',         email: 'bigd.worker4@example.com',   password: 'pass123',  role: 'Üye',               color: '#6554C0' },
  // ── BIGD — Siber Güvenlik Projesi ─────────────────────────────────────────
  { name: 'Burak Yıldırım',      email: 'bigd.pm2@example.com',       password: 'pass123',  role: 'PM (Siber Güvenlik)', color: '#8777D9' },
  { name: 'Murat Öztürk',        email: 'bigd.worker5@example.com',   password: 'pass123',  role: 'Üye',               color: '#8777D9' },
  { name: 'Selin Aydın',         email: 'bigd.worker6@example.com',   password: 'pass123',  role: 'Üye',               color: '#8777D9' },
  { name: 'Kemal Doğan',         email: 'bigd.worker7@example.com',   password: 'pass123',  role: 'Üye',               color: '#8777D9' },
  { name: 'Zehra Koç',           email: 'bigd.worker8@example.com',   password: 'pass123',  role: 'Üye',               color: '#8777D9' },
  // ── ODB — Öğrenci Bilgi Sistemi ───────────────────────────────────────────
  { name: 'Zeynep Çelik',        email: 'odb.baskan@example.com',     password: 'pass123',  role: 'Daire Başkanı',     color: '#FF5630' },
  { name: 'Can Öztürk',          email: 'odb.pm@example.com',         password: 'pass123',  role: 'PM (Öğrenci Bilgi)', color: '#FF5630' },
  { name: 'Deniz Yıldız',        email: 'odb.worker1@example.com',    password: 'pass123',  role: 'Üye',               color: '#FF5630' },
  { name: 'Burak Kara',          email: 'odb.worker2@example.com',    password: 'pass123',  role: 'Üye',               color: '#FF5630' },
  { name: 'Neslihan Güneş',      email: 'odb.worker3@example.com',    password: 'pass123',  role: 'Üye',               color: '#FF5630' },
  { name: 'Tarık Polat',         email: 'odb.worker4@example.com',    password: 'pass123',  role: 'Üye',               color: '#FF5630' },
  // ── ODB — Dijital Belge Yönetimi ──────────────────────────────────────────
  { name: 'Seda Kılıç',          email: 'odb.pm2@example.com',        password: 'pass123',  role: 'PM (Dijital Belge)', color: '#FFAB00' },
  { name: 'Gizem Yılmaz',        email: 'odb.worker5@example.com',    password: 'pass123',  role: 'Üye',               color: '#FFAB00' },
  { name: 'Serkan Avcı',         email: 'odb.worker6@example.com',    password: 'pass123',  role: 'Üye',               color: '#FFAB00' },
  { name: 'Pınar Erdoğan',       email: 'odb.worker7@example.com',    password: 'pass123',  role: 'Üye',               color: '#FFAB00' },
  { name: 'Emre Şimşek',         email: 'odb.worker8@example.com',    password: 'pass123',  role: 'Üye',               color: '#FFAB00' },
  // ── Dış Kullanıcı ─────────────────────────────────────────────────────────
  { name: 'Dış Kullanıcı',       email: 'dis.kullanici@example.com',  password: 'pass123',  role: 'Dış Kullanıcı',    color: '#36B37E' },
];

export default function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const user = await login(email, password);
      const route = ROLE_DEFAULT_ROUTES[user.role] || '/dashboard';
      navigate(route, { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function handleRowClick(acc) {
    setEmail(acc.email);
    setPassword(acc.password);
    setError('');
  }

  return (
    <div className="card shadow-sm" style={{ width: '100%' }}>
      <div className="card-body p-4">
        <div className="text-center mb-4">
          <h4 className="fw-bold text-primary mb-1">Kurumsal Proje Yönetimi</h4>
          <p className="text-muted small">Hesabınıza giriş yapın</p>
        </div>

        {error && (
          <div className="alert alert-danger py-2 small" role="alert">{error}</div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <div className="mb-3">
            <label htmlFor="login-email" className="form-label fw-medium">E-posta</label>
            <input
              id="login-email"
              type="email"
              className="form-control"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="ornek@kurum.edu.tr"
              required
              autoComplete="email"
            />
          </div>
          <div className="mb-4">
            <label htmlFor="login-password" className="form-label fw-medium">Şifre</label>
            <input
              id="login-password"
              type="password"
              className="form-control"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              autoComplete="current-password"
            />
          </div>
          <button type="submit" className="btn btn-primary w-100" disabled={loading}>
            {loading ? (
              <><span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true" />Giriş yapılıyor...</>
            ) : 'Giriş Yap'}
          </button>
        </form>

        {/* Demo accounts table */}
        <div className="mt-4 p-3 bg-light rounded" style={{ fontSize: '0.78rem' }}>
          <div className="d-flex align-items-center justify-content-between mb-2">
            <p className="fw-semibold mb-0 text-muted text-uppercase" style={{ fontSize: '0.7rem', letterSpacing: '0.05em' }}>
              Demo Hesapları — Satıra tıkla, otomatik doldur
            </p>
            <button
              type="button"
              className="btn btn-sm btn-outline-danger py-0 px-2"
              style={{ fontSize: '0.7rem' }}
              onClick={() => { localStorage.clear(); window.location.reload(); }}
              title="Önbelleği temizle ve sayfayı yenile"
            >
              Önbelleği Temizle
            </button>
          </div>

          <div style={{ maxHeight: 260, overflowY: 'auto', borderRadius: 6, border: '1px solid #dee2e6' }}>
            <table className="w-100" style={{ borderCollapse: 'collapse' }}>
              <thead style={{ position: 'sticky', top: 0, background: '#f8f9fa', zIndex: 1 }}>
                <tr className="text-muted" style={{ borderBottom: '1px solid #dee2e6' }}>
                  <th className="px-2 py-1 fw-medium">Ad</th>
                  <th className="px-2 py-1 fw-medium">E-posta</th>
                  <th className="px-2 py-1 fw-medium">Şifre</th>
                  <th className="px-2 py-1 fw-medium">Rol</th>
                </tr>
              </thead>
              <tbody>
                {DEMO_ACCOUNTS.map((acc) => (
                  <tr
                    key={acc.email}
                    onClick={() => handleRowClick(acc)}
                    style={{
                      borderBottom: '1px solid #f0f0f0',
                      cursor: 'pointer',
                      background: email === acc.email ? '#e8f0fe' : 'transparent',
                      transition: 'background 0.15s',
                    }}
                    title="Tıkla ve otomatik doldur"
                    onMouseEnter={e => { if (email !== acc.email) e.currentTarget.style.background = '#f5f5f5'; }}
                    onMouseLeave={e => { if (email !== acc.email) e.currentTarget.style.background = 'transparent'; }}
                  >
                    <td className="px-2 py-1 fw-medium">{acc.name}</td>
                    <td className="px-2 py-1 text-muted">{acc.email}</td>
                    <td className="px-2 py-1 text-muted">
                      <code style={{ fontSize: '0.72rem' }}>{acc.password}</code>
                    </td>
                    <td className="px-2 py-1">
                      <span
                        className="badge rounded-pill"
                        style={{ background: acc.color + '22', color: acc.color, fontSize: '0.65rem' }}
                      >
                        {acc.role}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
