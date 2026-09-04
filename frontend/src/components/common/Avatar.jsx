import React from 'react';

/**
 * Displays a circular avatar with the user's initials on a coloured background.
 *
 * @param {Object}  props
 * @param {string}  props.name         - Full name of the user
 * @param {string}  [props.color]      - Background colour (hex or CSS value)
 * @param {number}  [props.size]       - Diameter in pixels (default: 32)
 * @param {string}  [props.className]  - Additional CSS classes
 * @param {string}  [props.title]      - Tooltip text (defaults to name)
 */
function Avatar({ name = '', color = '#0052CC', size = 32, className = '', title }) {
  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('');

  const fontSize = Math.max(10, Math.floor(size * 0.4));

  const style = {
    width: size,
    height: size,
    minWidth: size,
    borderRadius: '50%',
    backgroundColor: color,
    color: '#ffffff',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize,
    fontWeight: 600,
    userSelect: 'none',
    flexShrink: 0,
  };

  return (
    <span
      style={style}
      className={className}
      title={title || name}
      aria-label={name}
      role="img"
    >
      {initials}
    </span>
  );
}

export default Avatar;
