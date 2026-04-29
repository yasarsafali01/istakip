import { format, formatDistanceToNow, parseISO, isValid } from 'date-fns';

/**
 * Formats an ISO date string into a human-readable date.
 * @param {string} dateString - ISO 8601 date string
 * @param {string} [pattern='dd MMM yyyy'] - date-fns format pattern
 * @returns {string} Formatted date string, or empty string if invalid
 */
export function formatDate(dateString, pattern = 'dd MMM yyyy') {
  if (!dateString) return '';
  try {
    const date = typeof dateString === 'string' ? parseISO(dateString) : dateString;
    if (!isValid(date)) return '';
    return format(date, pattern);
  } catch {
    return '';
  }
}

/**
 * Returns a relative time string (e.g. "3 minutes ago", "2 days ago").
 * @param {string} dateString - ISO 8601 date string
 * @returns {string} Relative time string, or empty string if invalid
 */
export function timeAgo(dateString) {
  if (!dateString) return '';
  try {
    const date = typeof dateString === 'string' ? parseISO(dateString) : dateString;
    if (!isValid(date)) return '';
    return formatDistanceToNow(date, { addSuffix: true });
  } catch {
    return '';
  }
}

/**
 * Returns the current date/time as an ISO 8601 string.
 * @returns {string} Current timestamp in ISO format
 */
export function nowISO() {
  return new Date().toISOString();
}

/**
 * Formats a date for display in forms (YYYY-MM-DD).
 * @param {string} dateString - ISO 8601 date string
 * @returns {string} Date formatted as YYYY-MM-DD
 */
export function formatDateInput(dateString) {
  return formatDate(dateString, 'yyyy-MM-dd');
}

/**
 * Formats time spent (in minutes) to "Xs Ydak" format.
 * Returns "—" if value is 0, null, or undefined.
 * @param {number|null|undefined} minutes - Time spent in minutes
 * @returns {string} Formatted time string (e.g., "2s 30dk", "45dk", "3s") or "—"
 */
export function formatTimeSpent(minutes) {
  if (!minutes || minutes <= 0) return '—';
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins}dk`;
  if (mins === 0) return `${hours}s`;
  return `${hours}s ${mins}dk`;
}
