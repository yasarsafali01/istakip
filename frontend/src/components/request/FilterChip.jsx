import React, { useState, useRef, useEffect } from 'react';
import { TbChevronDown } from 'react-icons/tb';

/**
 * Pill-style dropdown filter chip — matches the design in the screenshot.
 * Shows: [Icon] Label [▾]  — rounded pill, dropdown on click.
 *
 * @param {Object}   props
 * @param {React.ReactNode} props.icon     - Left icon element
 * @param {string}   props.label           - Button label (shows selected value or default)
 * @param {boolean}  [props.active]        - Whether a non-default value is selected (highlights chip)
 * @param {React.ReactNode} props.children - Dropdown content
 */
export default function FilterChip({ icon, label, active = false, children }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  return (
    <div className="position-relative d-inline-block" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="d-flex align-items-center gap-1 px-3 py-1"
        style={{
          border: `1.5px solid ${active ? '#0052CC' : '#dee2e6'}`,
          borderRadius: '999px',
          background: active ? '#EAF0FB' : '#fff',
          color: active ? '#0052CC' : '#495057',
          fontSize: '0.85rem',
          fontWeight: 500,
          cursor: 'pointer',
          whiteSpace: 'nowrap',
          transition: 'box-shadow 0.15s, border-color 0.15s',
          boxShadow: open ? '0 0 0 3px rgba(0,82,204,0.12)' : 'none',
          outline: 'none',
        }}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {icon && <span style={{ display: 'flex', alignItems: 'center' }}>{icon}</span>}
        <span>{label}</span>
        <TbChevronDown
          size={13}
          style={{
            marginLeft: 2,
            transition: 'transform 0.15s',
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
          }}
        />
      </button>

      {open && (
        <div
          className="position-absolute bg-white rounded shadow"
          style={{
            top: 'calc(100% + 6px)',
            left: 0,
            minWidth: 180,
            zIndex: 1050,
            border: '1px solid #dee2e6',
            padding: '4px 0',
          }}
          role="listbox"
        >
          {React.Children.map(children, child =>
            child
              ? React.cloneElement(child, {
                  onSelect: () => setOpen(false),
                })
              : null
          )}
        </div>
      )}
    </div>
  );
}

/**
 * A single option inside a FilterChip dropdown.
 *
 * @param {Object}   props
 * @param {boolean}  props.selected   - Whether this option is currently selected
 * @param {Function} props.onClick    - Called when option is clicked
 * @param {Function} [props.onSelect] - Injected by FilterChip to close dropdown
 * @param {React.ReactNode} props.children
 */
export function FilterChipOption({ selected, onClick, onSelect, children }) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      onClick={() => {
        onClick();
        onSelect?.();
      }}
      className="d-flex align-items-center gap-2 w-100 px-3 py-2 text-start"
      style={{
        background: selected ? '#EAF0FB' : 'transparent',
        color: selected ? '#0052CC' : '#212529',
        border: 'none',
        fontSize: '0.85rem',
        fontWeight: selected ? 600 : 400,
        cursor: 'pointer',
        transition: 'background 0.1s',
      }}
      onMouseEnter={e => { if (!selected) e.currentTarget.style.background = '#f8f9fa'; }}
      onMouseLeave={e => { if (!selected) e.currentTarget.style.background = 'transparent'; }}
    >
      {selected && (
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#0052CC', flexShrink: 0 }} />
      )}
      {!selected && <span style={{ width: 8, flexShrink: 0 }} />}
      {children}
    </button>
  );
}
