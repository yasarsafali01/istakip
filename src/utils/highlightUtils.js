import React from 'react';

/**
 * Escapes special regex characters in a string so it can be used safely
 * in a RegExp constructor without unintended pattern matching.
 *
 * @param {string} str
 * @returns {string}
 */
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Wraps occurrences of `query` inside `text` with a <mark> element.
 * Matching is case-insensitive. If `query` is empty or whitespace-only,
 * the original `text` string is returned unchanged.
 *
 * @param {string} text  - The full text to search within
 * @param {string} query - The search term to highlight
 * @returns {string | React.ReactNode[]}
 */
export function highlightText(text, query) {
  if (!query || !query.trim()) return text;
  if (!text) return text;

  const escaped = escapeRegex(query.trim());
  const regex = new RegExp(`(${escaped})`, 'gi');
  const parts = text.split(regex);

  // If no match found, return original string
  if (parts.length === 1) return text;

  return parts.map((part, index) =>
    regex.test(part) ? (
      <mark
        key={index}
        className="bg-warning bg-opacity-50 rounded-1 px-0"
        style={{ padding: '0 1px' }}
      >
        {part}
      </mark>
    ) : (
      part
    )
  );
}
