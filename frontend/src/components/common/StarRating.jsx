import React, { useState } from 'react';
import { TbStarFilled, TbStar } from 'react-icons/tb';

/**
 * A 1-5 star rating. Read-only when no onRate is given.
 * @param {Object}   props
 * @param {number}   [props.value]  - Current rating (1-5), 0/undefined = none
 * @param {Function} [props.onRate] - Called with the picked rating (1-5); omit for read-only
 * @param {number}   [props.size]
 */
function StarRating({ value = 0, onRate, size = 18 }) {
  const [hover, setHover] = useState(0);
  const interactive = typeof onRate === 'function';
  const shown = hover || value;

  return (
    <span className="d-inline-flex align-items-center gap-1" role={interactive ? 'radiogroup' : undefined} aria-label="Puan">
      {[1, 2, 3, 4, 5].map((n) => {
        const Icon = n <= shown ? TbStarFilled : TbStar;
        return (
          <span
            key={n}
            role={interactive ? 'radio' : undefined}
            aria-checked={interactive ? value === n : undefined}
            tabIndex={interactive ? 0 : undefined}
            onClick={() => interactive && onRate(n)}
            onKeyDown={(e) => interactive && e.key === 'Enter' && onRate(n)}
            onMouseEnter={() => interactive && setHover(n)}
            onMouseLeave={() => interactive && setHover(0)}
            style={{ cursor: interactive ? 'pointer' : 'default', color: n <= shown ? '#FFAB00' : '#DFE1E6', lineHeight: 0 }}
          >
            <Icon size={size} />
          </span>
        );
      })}
    </span>
  );
}

export default StarRating;
