import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TbBell } from 'react-icons/tb';
import { notificationsApi } from '../../api/resources';
import { timeAgo } from '../../utils/dateUtils';

const POLL_MS = 30000;

export default function NotificationBell() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [items, setItems] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const boxRef = useRef(null);

  const refreshCount = useCallback(() => {
    notificationsApi.unreadCount().then((r) => setUnread(r.count)).catch(() => {});
  }, []);

  useEffect(() => {
    refreshCount();
    const id = setInterval(refreshCount, POLL_MS);
    return () => clearInterval(id);
  }, [refreshCount]);

  useEffect(() => {
    function onClickOutside(e) {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next && !loaded) {
      notificationsApi.list().then((list) => { setItems(list); setLoaded(true); }).catch(() => {});
    }
  }

  async function handleItemClick(n) {
    if (!n.readAt) {
      try { await notificationsApi.markRead(n.id); } catch { /* ignore */ }
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, readAt: new Date().toISOString() } : x)));
      setUnread((c) => Math.max(0, c - 1));
    }
    setOpen(false);
    if (n.issueId) navigate(`/requests?issue=${n.issueId}`);
  }

  async function handleMarkAllRead() {
    try { await notificationsApi.markAllRead(); } catch { return; }
    setItems((prev) => prev.map((x) => ({ ...x, readAt: x.readAt || new Date().toISOString() })));
    setUnread(0);
  }

  return (
    <div className="position-relative" ref={boxRef}>
      <button type="button" className="icon-btn position-relative" onClick={toggle} title="Bildirimler" aria-label="Bildirimler">
        <TbBell aria-hidden="true" />
        {unread > 0 && (
          <span
            className="position-absolute badge rounded-pill"
            style={{ top: 2, right: 2, background: '#DE350B', fontSize: 9, padding: '2px 5px', lineHeight: 1 }}
          >
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          className="position-absolute bg-white rounded-3 shadow"
          style={{ top: '110%', right: 0, width: 320, maxHeight: 420, overflowY: 'auto', zIndex: 1060, border: '1px solid #E2E8F0' }}
        >
          <div className="d-flex align-items-center justify-content-between px-3 py-2 border-bottom">
            <span className="fw-semibold small">Bildirimler</span>
            {unread > 0 && (
              <button className="btn btn-link btn-sm p-0" style={{ fontSize: 12 }} onClick={handleMarkAllRead}>
                Tümünü okundu işaretle
              </button>
            )}
          </div>
          {!loaded ? (
            <div className="text-center text-muted small py-4">Yükleniyor…</div>
          ) : items.length === 0 ? (
            <div className="text-center text-muted small py-4">Bildirim yok.</div>
          ) : (
            items.map((n) => (
              <button
                key={n.id}
                onClick={() => handleItemClick(n)}
                className="d-block w-100 text-start border-0 border-bottom px-3 py-2"
                style={{ background: n.readAt ? '#fff' : '#EFF6FF', fontSize: 12.5 }}
              >
                <div className="fw-semibold" style={{ color: '#172B4D' }}>{n.title}</div>
                {n.body && <div className="text-muted text-truncate">{n.body}</div>}
                <div className="text-muted" style={{ fontSize: 11 }}>{timeAgo(n.createdAt)}</div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
