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
        className={`ds-filter ${active ? 'ds-filter--on' : ''}`}
        style={{ cursor: 'pointer', outline: 'none', boxShadow: open ? '0 0 0 3px rgba(31,40,85,0.12)' : 'none' }}
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
          className="ds-menu"
          style={{ left: 0, right: 'auto' }}
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
      className={`d-flex align-items-center gap-2 ${selected ? 'on' : ''}`}
    >
      {selected && (
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--navy)', flexShrink: 0 }} />
      )}
      {!selected && <span style={{ width: 8, flexShrink: 0 }} />}
      {children}
    </button>
  );
}
