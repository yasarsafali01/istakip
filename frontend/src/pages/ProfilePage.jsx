import React, { useState } from 'react';
import { TbMapPin, TbBell, TbLock, TbUsers } from 'react-icons/tb';
import { useAuth } from '../hooks/useAuth';
import { useAppContext } from '../context/AppContext';
import { usersApi } from '../api/resources';
import { ACTIONS } from '../constants';
import Avatar from '../components/common/Avatar';

const ROLE_LABELS = {
  System_Admin: 'Sistem Yöneticisi',
  Department_Head: 'Daire Başkanı',
  Project_Manager: 'Müdür',
  Worker: 'Çalışan',
  External_User: 'Talep Sahibi',
  University_Staff: 'Üniversite Personeli',
  Student: 'Öğrenci',
};

export default function ProfilePage() {
  const { currentUser } = useAuth();
  const { dispatch } = useAppContext();

  const [building, setBuilding] = useState(currentUser?.building || '');
  const [floor, setFloor] = useState(currentUser?.floor || '');
  const [room, setRoom] = useState(currentUser?.room || '');
  const [notifyEmail, setNotifyEmail] = useState(currentUser?.notifyEmail ?? true);
  const [notifySms, setNotifySms] = useState(currentUser?.notifySms ?? false);
  const [notifyPush, setNotifyPush] = useState(currentUser?.notifyPush ?? true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState('');

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newPassword2, setNewPassword2] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordMsg, setPasswordMsg] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  async function handleSaveProfile(e) {
    e.preventDefault();
    setSavingProfile(true);
    setProfileMsg('');
    try {
      const updated = await usersApi.updateMe({ building, floor, room, notifyEmail, notifySms, notifyPush });
      dispatch({ type: ACTIONS.LOGIN, payload: { ...currentUser, ...updated } });
      setProfileMsg('Kaydedildi.');
    } catch (err) {
      setProfileMsg(err.message);
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleChangePassword(e) {
    e.preventDefault();
    setPasswordError('');
    setPasswordMsg('');
    if (newPassword.length < 6) { setPasswordError('Yeni şifre en az 6 karakter olmalıdır.'); return; }
    if (newPassword !== newPassword2) { setPasswordError('Yeni şifreler eşleşmiyor.'); return; }
    setChangingPassword(true);
    try {
      await usersApi.changePassword(currentPassword, newPassword);
      setPasswordMsg('Şifreniz değiştirildi.');
      setCurrentPassword(''); setNewPassword(''); setNewPassword2('');
    } catch (err) {
      setPasswordError(err.message);
    } finally {
      setChangingPassword(false);
    }
  }

  if (!currentUser) return null;

  return (
    <div style={{ maxWidth: 680 }}>
      <h4 className="fw-bold mb-1">Profilim</h4>
      <p className="text-muted small mb-4">Kişisel bilgilerinizi, konumunuzu ve bildirim tercihlerinizi bu sayfadan yönetin.</p>

      <div className="card mb-4">
        <div className="card-body d-flex align-items-center gap-3">
          <Avatar name={currentUser.name} color={currentUser.avatarColor} size={52} />
          <div>
            <div className="fw-semibold">{currentUser.name}</div>
            <div className="text-muted small">{currentUser.email}</div>
            <div className="text-muted small">{ROLE_LABELS[currentUser.roleKey || currentUser.role] || currentUser.role}</div>
          </div>
        </div>
      </div>

      <div className="card mb-4">
        <div className="card-body">
          <h6 className="fw-semibold d-flex align-items-center gap-2 mb-3">
            <TbUsers size={16} /> Ekiplerim
          </h6>
          {(currentUser.teams || []).length === 0 ? (
            <p className="text-muted small fst-italic mb-0">Henüz bir ekipte görev almıyorsunuz.</p>
          ) : (
            <div className="d-flex flex-wrap gap-2">
              {currentUser.teams.map((t) => (
                <span key={t.teamId} className="badge text-bg-light border fw-normal" style={{ fontSize: 12 }}>
                  <span className="fw-semibold">{t.teamName}</span>
                  <span className="text-muted"> · {t.projectName}</span>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      <form className="card mb-4" onSubmit={handleSaveProfile}>
        <div className="card-body">
          <h6 className="fw-semibold d-flex align-items-center gap-2 mb-3">
            <TbMapPin size={16} /> Konum Bilgileri
          </h6>
          <p className="text-muted small mb-3">
            Yerinde müdahale gereken taleplerde size ulaşılabilmesi için kullanılır.
          </p>
          <div className="row g-2 mb-3">
            <div className="col-4">
              <label className="form-label small fw-medium">Bina</label>
              <input className="form-control form-control-sm" value={building} onChange={(e) => setBuilding(e.target.value)} />
            </div>
            <div className="col-4">
              <label className="form-label small fw-medium">Kat</label>
              <input className="form-control form-control-sm" value={floor} onChange={(e) => setFloor(e.target.value)} />
            </div>
            <div className="col-4">
              <label className="form-label small fw-medium">Oda No</label>
              <input className="form-control form-control-sm" value={room} onChange={(e) => setRoom(e.target.value)} />
            </div>
          </div>

          <h6 className="fw-semibold d-flex align-items-center gap-2 mb-3 mt-4">
            <TbBell size={16} /> Bildirim Tercihleri
          </h6>
          <div className="form-check form-switch mb-2">
            <input className="form-check-input" type="checkbox" role="switch" id="notify-push" checked={notifyPush} onChange={(e) => setNotifyPush(e.target.checked)} />
            <label className="form-check-label small" htmlFor="notify-push">Uygulama içi bildirimler</label>
          </div>
          <div className="form-check form-switch mb-2">
            <input className="form-check-input" type="checkbox" role="switch" id="notify-email" checked={notifyEmail} onChange={(e) => setNotifyEmail(e.target.checked)} />
            <label className="form-check-label small" htmlFor="notify-email">E-posta bildirimleri</label>
          </div>
          <div className="form-check form-switch mb-3">
            <input className="form-check-input" type="checkbox" role="switch" id="notify-sms" checked={notifySms} onChange={(e) => setNotifySms(e.target.checked)} />
            <label className="form-check-label small" htmlFor="notify-sms">SMS bildirimleri</label>
          </div>
          <p className="text-muted" style={{ fontSize: '0.72rem' }}>
            Not: Şu an yalnızca uygulama içi bildirimler gönderiliyor; e-posta/SMS entegrasyonu henüz eklenmedi, tercihiniz kaydedilir.
          </p>

          <div className="d-flex align-items-center gap-2 mt-3">
            <button type="submit" className="btn btn-primary btn-sm" disabled={savingProfile}>
              {savingProfile ? 'Kaydediliyor…' : 'Kaydet'}
            </button>
            {profileMsg && <span className="text-muted small">{profileMsg}</span>}
          </div>
        </div>
      </form>

      <form className="card" onSubmit={handleChangePassword}>
        <div className="card-body">
          <h6 className="fw-semibold d-flex align-items-center gap-2 mb-3">
            <TbLock size={16} /> Şifre Değiştir
          </h6>
          {passwordError && <div className="alert alert-danger py-2 small">{passwordError}</div>}
          <div className="mb-2">
            <label className="form-label small fw-medium">Mevcut Şifre</label>
            <input type="password" className="form-control form-control-sm" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required />
          </div>
          <div className="mb-2">
            <label className="form-label small fw-medium">Yeni Şifre</label>
            <input type="password" className="form-control form-control-sm" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
          </div>
          <div className="mb-3">
            <label className="form-label small fw-medium">Yeni Şifre (Tekrar)</label>
            <input type="password" className="form-control form-control-sm" value={newPassword2} onChange={(e) => setNewPassword2(e.target.value)} required />
          </div>
          <div className="d-flex align-items-center gap-2">
            <button type="submit" className="btn btn-outline-primary btn-sm" disabled={changingPassword}>
              {changingPassword ? 'Değiştiriliyor…' : 'Şifreyi Değiştir'}
            </button>
            {passwordMsg && <span className="text-success small">{passwordMsg}</span>}
          </div>
        </div>
      </form>
    </div>
  );
}
