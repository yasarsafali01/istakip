import React, { useId } from 'react';
import { TbSearch, TbX } from 'react-icons/tb';

/**
 * Modern search bar with floating label, clear button, and result count.
 *
 * @param {Object}   props
 * @param {string}   props.value        - Controlled input value
 * @param {Function} props.onChange     - Called on every keystroke with new string value
 * @param {number}   props.resultCount  - Number of results to display below the input
 * @param {string}   [props.placeholder] - Floating label text (default: "Talep ara...")
 */
export default function ModernSearchBar({
  value,
  onChange,
  resultCount,
  placeholder = 'Talep ara...',
}) {
  const inputId = useId();
  const hasValue = value.length > 0;

  return (
    <div className="mb-3">
      <div className="position-relative">
        {/* Search icon — left side */}
        <span
          className="position-absolute d-flex align-items-center text-muted"
          style={{ top: '50%', left: '12px', transform: 'translateY(-50%)', zIndex: 5, pointerEvents: 'none' }}
          aria-hidden="true"
        >
          <TbSearch size={16} />
        </span>

        {/* Plain input — placeholder disappears on focus/type */}
        <input
          id={inputId}
          type="text"
          className="form-control"
          placeholder={placeholder}
          value={value}
          onChange={e => onChange(e.target.value)}
          style={{
            paddingLeft: '2.5rem',
            paddingRight: hasValue ? '2.5rem' : '0.75rem',
            height: '42px',
          }}
          autoComplete="off"
          aria-label={placeholder}
        />

        {/* Clear button — right side, visible only when input has value */}
        {hasValue && (
          <button
            type="button"
            className="btn btn-link position-absolute d-flex align-items-center justify-content-center p-0 text-muted"
            style={{ top: '50%', right: '10px', transform: 'translateY(-50%)', zIndex: 5, width: 24, height: 24 }}
            onClick={() => onChange('')}
            aria-label="Aramayı temizle"
          >
            <TbX size={16} />
          </button>
        )}
      </div>

      {/* Result count */}
      <div className="mt-1 ps-1">
        <small className="text-muted">{resultCount} talep bulundu</small>
      </div>
    </div>
  );
}
