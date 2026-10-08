import React, { useRef, useState } from 'react';
import { TbPaperclip, TbX, TbUpload, TbLoader2 } from 'react-icons/tb';
import { filesApi } from '../../api/resources';
import { acceptedExtensions, formatBytes, MAX_UPLOAD_MB, FILE_CATEGORIES } from '../../utils/requestForm';

/**
 * File-upload answer. Files upload as soon as they're picked; the answer
 * value is the list of uploaded files ({ id, name, size }) and only their ids
 * are sent when the request is created. In `preview` mode (form builder)
 * nothing is uploaded — picked files are just listed.
 */
export default function FileQuestion({ q, id, value, invalid, onChange, preview = false, onBusy }) {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState([]); // names in flight
  const [error, setError] = useState('');

  const files = Array.isArray(value) ? value : [];
  const max = q.settings?.maxFiles || 1;
  const exts = acceptedExtensions(q.settings);
  const remaining = max - files.length - uploading.length;
  const acceptLabel = q.settings?.accept?.length
    ? FILE_CATEGORIES.filter((c) => q.settings.accept.includes(c.key)).map((c) => c.label).join(', ')
    : 'Görsel, PDF, Office, metin, arşiv';

  async function handlePick(e) {
    const picked = Array.from(e.target.files || []);
    e.target.value = ''; // allow picking the same file again after removing it
    setError('');
    if (picked.length === 0) return;

    if (picked.length > remaining) {
      setError(`En fazla ${max} dosya yükleyebilirsiniz.`);
      picked.splice(Math.max(remaining, 0));
    }
    const ok = [];
    for (const f of picked) {
      const ext = `.${f.name.split('.').pop().toLowerCase()}`;
      if (!exts.includes(ext)) setError(`${f.name}: bu dosya türüne izin verilmiyor.`);
      else if (f.size > MAX_UPLOAD_MB * 1024 * 1024) setError(`${f.name}: dosya ${MAX_UPLOAD_MB} MB'tan büyük.`);
      else ok.push(f);
    }
    if (ok.length === 0) return;

    if (preview) {
      onChange([...files, ...ok.map((f, i) => ({ id: `preview-${Date.now()}-${i}`, name: f.name, size: f.size }))]);
      return;
    }

    setUploading((u) => [...u, ...ok.map((f) => f.name)]);
    onBusy?.(true);
    let next = files;
    for (const f of ok) {
      try {
        const saved = await filesApi.upload(f);
        next = [...next, { id: saved.id, name: saved.name, size: saved.size }];
        onChange(next);
      } catch (err) {
        setError(`${f.name}: ${err.message || 'yüklenemedi'}`);
      } finally {
        setUploading((u) => u.filter((n, i) => i !== u.indexOf(f.name)));
      }
    }
    onBusy?.(false);
  }

  return (
    <div id={id}>
      {(files.length > 0 || uploading.length > 0) && (
        <ul className="list-unstyled mb-2 d-flex flex-column gap-1">
          {files.map((f) => (
            <li key={f.id} className="d-flex align-items-center gap-2 border rounded px-2 py-1 bg-white small">
              <TbPaperclip size={14} className="text-primary flex-shrink-0" />
              <span className="text-truncate flex-grow-1" title={f.name}>{f.name}</span>
              <span className="text-muted flex-shrink-0">{formatBytes(f.size)}</span>
              <button type="button" className="btn btn-sm btn-link text-danger p-0" title="Kaldır"
                aria-label={`${f.name} dosyasını kaldır`}
                onClick={() => onChange(files.filter((x) => x.id !== f.id))}>
                <TbX size={14} />
              </button>
            </li>
          ))}
          {uploading.map((name, i) => (
            <li key={`up-${i}`} className="d-flex align-items-center gap-2 border rounded px-2 py-1 small text-muted">
              <TbLoader2 size={14} className="spin" /> <span className="text-truncate">{name} yükleniyor…</span>
            </li>
          ))}
        </ul>
      )}

      {remaining > 0 && (
        <>
          <input ref={inputRef} type="file" className="d-none" multiple={remaining > 1}
            accept={exts.join(',')} onChange={handlePick} />
          <button type="button"
            className={`btn btn-outline-secondary btn-sm d-flex align-items-center gap-1 ${invalid ? 'border-danger text-danger' : ''}`}
            onClick={() => inputRef.current?.click()}>
            <TbUpload size={15} /> {files.length ? 'Dosya ekle' : 'Dosya seç'}
          </button>
        </>
      )}
      <div className="form-text mt-1">
        {acceptLabel} · en fazla {max} dosya · dosya başına {MAX_UPLOAD_MB} MB
      </div>
      {error && <div className="text-danger small mt-1">{error}</div>}
    </div>
  );
}
