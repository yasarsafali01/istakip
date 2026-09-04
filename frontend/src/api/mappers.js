// The backend's Issue shape differs slightly from the old in-memory model:
// `number` is a per-project integer and the Jira-style "BIGD-1" string is
// `key`, and `unitCode` isn't stored on the issue at all (it's derived via
// project → unit). The rest of the app still expects `number` to be that
// display string and `unitCode` to be present directly on the issue, so we
// map every issue coming back from the API through here rather than touch
// every component that reads those two fields.

export function buildUnitCodeByProjectId(projects, units) {
  const unitCodeById = new Map(units.map((u) => [u.id, u.unitCode]));
  const map = new Map();
  for (const p of projects) {
    map.set(p.id, unitCodeById.get(p.unitId) || '');
  }
  return map;
}

export function mapIssue(issue, unitCodeByProjectId) {
  return {
    ...issue,
    number: issue.key,
    unitCode: unitCodeByProjectId.get(issue.projectId) || issue.unitCode || '',
  };
}

export function mapIssues(issues, unitCodeByProjectId) {
  return issues.map((i) => mapIssue(i, unitCodeByProjectId));
}
