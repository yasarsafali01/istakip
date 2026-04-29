/**
 * Generates a unique ID using crypto.randomUUID if available,
 * otherwise falls back to a simple timestamp-based ID.
 * @returns {string} A unique identifier string
 */
export function generateId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for environments without crypto.randomUUID
  return (
    Math.random().toString(36).substring(2, 11) +
    '-' +
    Date.now().toString(36)
  );
}

/**
 * Generates a Jira-style issue key (e.g. "PROJ-1", "PROJ-2").
 * @param {string} projectKey - The project key prefix (e.g. "PROJ")
 * @param {number} issueNumber - The sequential issue number
 * @returns {string} The formatted issue key
 */
export function generateIssueKey(projectKey, issueNumber) {
  return `${projectKey}-${issueNumber}`;
}

/**
 * Returns the next available issue number for a given project.
 * @param {Array} issues - Array of existing issue objects
 * @param {string} projectId - The project ID to filter by
 * @returns {number} The next issue number
 */
export function getNextIssueNumber(issues, projectId) {
  const projectIssues = issues.filter((issue) => issue.projectId === projectId);
  if (projectIssues.length === 0) return 1;
  const maxNumber = Math.max(...projectIssues.map((issue) => issue.number));
  return maxNumber + 1;
}

/**
 * Filters issues by assignee ID.
 * @param {Array} issues - Array of issue objects
 * @param {string|null} assigneeId - The assignee ID to filter by, or null for all
 * @returns {Array} Filtered issues
 */
export function filterByAssignee(issues, assigneeId) {
  if (!assigneeId) return issues;
  return issues.filter((issue) => issue.assigneeId === assigneeId);
}

/**
 * Filters issues by priority.
 * @param {Array} issues - Array of issue objects
 * @param {string|null} priority - The priority to filter by, or null for all
 * @returns {Array} Filtered issues
 */
export function filterByPriority(issues, priority) {
  if (!priority) return issues;
  return issues.filter((issue) => issue.priority === priority);
}

/**
 * Groups issues by their status field.
 * @param {Array} issues - Array of issue objects
 * @returns {Object} An object keyed by status with arrays of issues as values
 */
export function groupIssuesByStatus(issues) {
  return issues.reduce((acc, issue) => {
    const status = issue.status;
    if (!acc[status]) acc[status] = [];
    acc[status].push(issue);
    return acc;
  }, {});
}
