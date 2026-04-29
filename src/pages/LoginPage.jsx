import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import LoginForm from '../components/auth/LoginForm';
import { useAuth } from '../hooks/useAuth';

const DEMO_ACCOUNTS = [
  {
    group: 'Yönetim',
    color: '#0052CC',
    accounts: [
      { label: 'Sistem Yöneticisi', email: 'admin@example.com', password: 'admin123', badge: 'System Admin' },
    ],
  },
  {
    group: 'Bilgi İşlem — Ağ Altyapısı Yenileme',
    color: '#00875A',
    accounts: [
      { label: 'Ayşe Kaya (Daire Başkanı)', email: 'bigd.baskan@example.com', password: 'pass123', badge: 'Dept. Head' },
      { label: 'Mehmet Demir (Proje Yöneticisi)', email: 'bigd.pm@example.com', password: 'pass123', badge: 'PM' },
      { label: 'Ali Yılmaz (Üye)', email: 'bigd.worker1@example.com', password: 'pass123', badge: 'Worker' },
      { label: 'Fatma Şahin (Üye)', email: 'bigd.worker2@example.com', password: 'pass123', badge: 'Worker' },
      { label: 'Hasan Çelik (Üye)', email: 'bigd.worker3@example.com', password: 'pass123', badge: 'Worker' },
      { label: 'Elif Arslan (Üye)', email: 'bigd.worker4@example.com', password: 'pass123', badge: 'Worker' },
    ],
  },
  {
    group: 'Bilgi İşlem — Siber Güvenlik Projesi',
    color: '#8777D9',
    accounts: [
      { label: 'Burak Yıldırım (Proje Yöneticisi)', email: 'bigd.pm2@example.com', password: 'pass123', badge: 'PM' },
      { label: 'Murat Öztürk (Üye)', email: 'bigd.worker5@example.com', password: 'pass123', badge: 'Worker' },
      { label: 'Selin Aydın (Üye)', email: 'bigd.worker6@example.com', password: 'pass123', badge: 'Worker' },
      { label: 'Kemal Doğan (Üye)', email: 'bigd.worker7@example.com', password: 'pass123', badge: 'Worker' },
      { label: 'Zehra Koç (Üye)', email: 'bigd.worker8@example.com', password: 'pass123', badge: 'Worker' },
    ],
  },
  {
    group: 'Öğrenci İşleri — Öğrenci Bilgi Sistemi',
    color: '#FF5630',
    accounts: [
      { label: 'Zeynep Çelik (Daire Başkanı)', email: 'odb.baskan@example.com', password: 'pass123', badge: 'Dept. Head' },
      { label: 'Can Öztürk (Proje Yöneticisi)', email: 'odb.pm@example.com', password: 'pass123', badge: 'PM' },
      { label: 'Deniz Yıldız (Üye)', email: 'odb.worker1@example.com', password: 'pass123', badge: 'Worker' },
      { label: 'Burak Kara (Üye)', email: 'odb.worker2@example.com', password: 'pass123', badge: 'Worker' },
      { label: 'Neslihan Güneş (Üye)', email: 'odb.worker3@example.com', password: 'pass123', badge: 'Worker' },
      { label: 'Tarık Polat (Üye)', email: 'odb.worker4@example.com', password: 'pass123', badge: 'Worker' },
    ],
  },
  {
    group: 'Öğrenci İşleri — Dijital Belge Yönetimi',
    color: '#FFAB00',
    accounts: [
      { label: 'Seda Kılıç (Proje Yöneticisi)', email: 'odb.pm2@example.com', password: 'pass123', badge: 'PM' },
      { label: 'Gizem Yılmaz (Üye)', email: 'odb.worker5@example.com', password: 'pass123', badge: 'Worker' },
      { label: 'Serkan Avcı (Üye)', email: 'odb.worker6@example.com', password: 'pass123', badge: 'Worker' },
      { label: 'Pınar Erdoğan (Üye)', email: 'odb.worker7@example.com', password: 'pass123', badge: 'Worker' },
      { label: 'Emre Şimşek (Üye)', email: 'odb.worker8@example.com', password: 'pass123', badge: 'Worker' },
    ],
  },
  {
    group: 'Dış Kullanıcı',
    color: '#36B37E',
    accounts: [
      { label: 'Dış Kullanıcı', email: 'dis.kullanici@example.com', password: 'pass123', badge: 'External' },
    ],
  },
];

export default function LoginPage() {
  const { isAuthenticated, getDefaultRoute } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated) {
      navigate(getDefaultRoute(), { replace: true });
    }
  }, [isAuthenticated, navigate, getDefaultRoute]);

  function handleReset() {
    localStorage.clear();
    window.location.reload();
  }

  return (
    <div
      className="min-vh-100 d-flex align-items-start justify-content-center py-4 px-2"
      style={{ background: 'linear-gradient(135deg, #f0f4ff 0%, #e8f0fe 100%)' }}
    >
      <div style={{ width: '100%', maxWidth: 920 }}>
        <div className="row g-4 align-items-start">
          {/* Login form */}
          <div className="col-12 col-md-5">
            <div className="position-sticky" style={{ top: '1rem' }}>
              <LoginForm />
              <div className="text-center mt-3">
                <button
                  className="btn btn-link btn-sm text-muted"
                  style={{ fontSize: '0.72rem' }}
                  onClick={handleReset}
                >
                  🔄 Veriyi Sıfırla (Demo)
                </button>
              </div>
            </div>
          </div>

          {/* Demo accounts panel */}
          <div className="col-12 col-md-7">
            <div className="card border-0 shadow-sm">
              <div className="card-header bg-white border-bottom py-3">
                <h6 className="fw-bold mb-1" style={{ fontSize: '0.9rem' }}>
                  🔑 Demo Giriş Bilgileri
                </h6>
                <p className="text-muted mb-0" style={{ fontSize: '0.75rem' }}>
                  Tüm hesaplar için şifre: <code>pass123</code> &nbsp;|&nbsp; Admin şifresi: <code>admin123</code>
                </p>
              </div>
              <div className="card-body p-0" style={{ maxHeight: '72vh', overflowY: 'auto' }}>
                {DEMO_ACCOUNTS.map((group) => (
                  <div key={group.group}>
                    {/* Group header */}
                    <div
                      className="px-3 py-2 d-flex align-items-center gap-2"
                      style={{ background: '#F4F5F7', borderBottom: '1px solid #e8e8e8' }}
                    >
                      <span
                        style={{
                          width: 9, height: 9, borderRadius: '50%',
                          background: group.color, display: 'inline-block', flexShrink: 0,
                        }}
                      />
                      <span className="fw-semibold" style={{ fontSize: '0.73rem', color: '#42526E' }}>
                        {group.group}
                      </span>
                    </div>
                    {/* Accounts */}
                    {group.accounts.map((acc) => (
                      <div
                        key={acc.email}
                        className="px-3 py-2 d-flex align-items-center gap-2 border-bottom"
                        style={{ fontSize: '0.78rem' }}
                      >
                        <span
                          className="badge rounded-pill flex-shrink-0"
                          style={{
                            background: group.color + '22',
                            color: group.color,
                            fontSize: '0.63rem',
                            minWidth: 54,
                            textAlign: 'center',
                          }}
                        >
                          {acc.badge}
                        </span>
                        <span className="fw-medium flex-grow-1 text-truncate" style={{ minWidth: 0 }}>
                          {acc.label}
                        </span>
                        <code
                          className="text-muted flex-shrink-0"
                          style={{ fontSize: '0.71rem' }}
                        >
                          {acc.email}
                        </code>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
