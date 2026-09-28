import React from 'react';
import {
  TbArrowBigUpFilled,
  TbArrowBigUpLinesFilled,
  TbArrowBigDownFilled,
  TbArrowBigDownLinesFilled,
  TbArrowBigRightFilled,
} from 'react-icons/tb';
import { PRIORITY_COLORS, PRIORITY_LABELS } from '../../constants';

const PRIORITY_ICONS = {
  Highest: TbArrowBigUpLinesFilled,
  High: TbArrowBigUpFilled,
  Medium: TbArrowBigRightFilled,
  Low: TbArrowBigDownFilled,
  Lowest: TbArrowBigDownLinesFilled,
};

/**
 * Renders a coloured icon representing an issue priority level.
 *
 * @param {Object}  props
 * @param {string}  props.priority   - One of: Highest | High | Medium | Low | Lowest
 * @param {number}  [props.size]     - Icon size in pixels (default: 16)
 * @param {boolean} [props.showLabel] - Whether to render the priority label next to the icon
 * @param {string}  [props.className] - Additional CSS classes on the wrapper
 */
function PriorityIcon({ priority, size = 16, showLabel = false, className = '' }) {
  const Icon = PRIORITY_ICONS[priority] || TbArrowBigRightFilled;
  const color = PRIORITY_COLORS[priority] || '#FFAA00';
  const label = PRIORITY_LABELS[priority] || priority;

  return (
    <span
      className={`d-inline-flex align-items-center gap-1 ${className}`}
      title={label}
      aria-label={`Öncelik: ${label}`}
    >
      <Icon size={size} color={color} aria-hidden="true" />
      {showLabel && (
        <span style={{ fontSize: '0.8rem', color }} className="fw-semibold">
          {label}
        </span>
      )}
    </span>
  );
}

export default PriorityIcon;
