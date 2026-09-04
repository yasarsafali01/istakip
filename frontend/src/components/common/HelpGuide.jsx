import React, { useState } from 'react';
import { TbHelp } from 'react-icons/tb';
import Modal from './Modal';

/**
 * Yardım Kılavuzu butonu ve modalı.
 * Sayfa başlıklarının yanına eklenir.
 *
 * @param {string} title   - Modal başlığı
 * @param {Array}  sections - [{ icon, title, items: [string] }]
 */
export default function HelpGuide({ title, sections = [] }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className="btn btn-link p-0 text-muted d-flex align-items-center gap-1"
        style={{ lineHeight: 1, fontSize: '0.82rem', textDecoration: 'none' }}
        onClick={() => setOpen(true)}
        title="Yardım Kılavuzu"
        aria-label="Yardım Kılavuzu"
      >
        <TbHelp size={18} />
        <span className="d-none d-sm-inline">Yardım Kılavuzu</span>
      </button>

      <Modal isOpen={open} onClose={() => setOpen(false)} title={title} size="lg">
        <div style={{ fontSize: '0.9rem' }}>
          {sections.map((section, i) => (
            <div key={i} className="mb-4">
              <h6 className="fw-semibold mb-2">
                {section.icon} {section.title}
              </h6>
              <ul className="mb-0 ps-3 text-muted">
                {section.items.map((item, j) => (
                  <li key={j} className="mb-1">{item}</li>
                ))}
              </ul>
            </div>
          ))}
          <div className="d-flex justify-content-end mt-3">
            <button className="btn btn-primary btn-sm" onClick={() => setOpen(false)}>
              Anladım
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
