import { useState, useMemo } from 'react';

/**
 * Hook that manages assignee and priority filter state and returns
 * a filtered subset of the provided issues array.
 *
 * @param {Array} issues - The full list of issue objects to filter
 * @returns {{
 *   filteredIssues: Array,
 *   assigneeFilter: string|null,
 *   priorityFilter: string|null,
 *   setAssigneeFilter: Function,
 *   setPriorityFilter: Function,
 *   clearFilters: Function
 * }}
 */
function useIssueFilters(issues, defaultAssigneeFilter = null) {
  const [assigneeFilter, setAssigneeFilter] = useState(defaultAssigneeFilter);
  const [priorityFilter, setPriorityFilter] = useState(null);

  const filteredIssues = useMemo(() => {
    let result = issues;

    if (assigneeFilter) {
      result = result.filter((issue) => issue.assigneeId === assigneeFilter);
    }

    if (priorityFilter) {
      result = result.filter((issue) => issue.priority === priorityFilter);
    }

    return result;
  }, [issues, assigneeFilter, priorityFilter]);

  function clearFilters() {
    setAssigneeFilter(null);
    setPriorityFilter(null);
  }

  return {
    filteredIssues,
    assigneeFilter,
    priorityFilter,
    setAssigneeFilter,
    setPriorityFilter,
    clearFilters,
  };
}

export default useIssueFilters;
