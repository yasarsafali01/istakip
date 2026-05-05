import React from 'react';
import { STATUS_COLORS, ISSUE_TYPE_COLORS } from '../../constants';

/**
 * A small pill-shaped label for statuses, issue types, or custom values.
 *
 * @param {Object}  props
 * @param {string}  props.label       - Text to display inside the badge
 * @param {string}  [props.type]      - 'status' | 'issueType' | 'custom'
 * @param {string}  [props.color]     - Override background colour (used when type='custom')
 * @param {string}  [props.className] - Additional CSS classes
 */
function Badge({ label, type = 'custom', color, className = '' }) {
  let bgColor = color || '#6c757d';
  let textColor = '#ffffff';

  if (type === 'status' && STATUS_COLORS[label]) {
    bgColor = STATUS_COLORS[label];
    // Use dark text for light backgrounds
    if (label === 'To Do') textColor = '#42526E';
    // Use white text for dark backgrounds
    if (label === 'Geri Çevrildi') textColor = '#ffffff';
  } else if (type === 'issueType' && ISSUE_TYPE_COLORS[label]) {
    bgColor = ISSUE_TYPE_COLORS[label];
  }

  // "Talep" için özel renk - mavi ton
  if (label === 'Talep') {
    bgColor = '#0052CC';
    textColor = '#ffffff';
  }

  const style = {
    backgroundColor: bgColor,
    color: textColor,
    fontSize: '0.7rem',
    fontWeight: 600,
    padding: '4px 12px',
    borderRadius: '12px', // Daha oval
    display: 'inline-block',
    whiteSpace: 'nowrap',
    letterSpacing: '0.02em',
  };

  return (
    <span style={style} className={className}>
      {label}
    </span>
  );
}

export default Badge;
