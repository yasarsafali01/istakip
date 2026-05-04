import React, { useId } from 'react';
import { TbBuilding } from 'react-icons/tb';

/**
 * Modern select-based unit filter for the requests list.
 * Renders nothing when there are zero available units.
 *
 * @param {Object}        props
 * @param {Array}         props.units          - Available units derived from visible requests
 * @param {string|null}   props.selectedUnitId - Currently selected unit ID (null = "Tümü")
 * @param {Function}      props.onChange       - Called with unitId (string) or null for "Tümü"
 */
export default function UnitFilter({ units, selectedUnitId, onChange }) {
  const selectId = useId();

  if (!units || units.length === 0) return null;

  function handleChange(e) {
    const val = e.target.value;
    onChange(val === '' ? null : val);
  }

  return (
    <div className="mb-3">
      <div className="position-relative">
        {/* Building icon — left side */}
        <span
          className="position-absolute d-flex align-items-center text-muted"
          style={{
            top: '50%',
            left: '12px',
            transform: 'translateY(-50%)',
            zIndex: 5,
            pointerEvents: 'none',
          }}
          aria-hidden="true"
        >
          <TbBuilding size={16} />
        </span>

        {/* Floating label select */}
        <div className="form-floating">
          <select
            id={selectId}
            className="form-select"
            value={selectedUnitId ?? ''}
            onChange={handleChange}
            style={{ paddingLeft: '2.5rem' }}
            aria-label="Birime göre filtrele"
          >
            <option value="">Tüm Birimler</option>
            {units.map(unit => (
              <option key={unit.id} value={unit.id}>
                {unit.unitCode} — {unit.name}
              </option>
            ))}
          </select>
          <label
            htmlFor={selectId}
            style={{ paddingLeft: '2.5rem', color: '#6c757d' }}
          >
            Birim
          </label>
        </div>
      </div>
    </div>
  );
}
