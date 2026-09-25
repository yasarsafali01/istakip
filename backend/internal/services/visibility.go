package services

import (
	"github.com/yasarsafali01/istakip/backend/internal/models"
	"github.com/yasarsafali01/istakip/backend/internal/repository"
)

// IssueScopeFor mirrors frontend/src/utils/permissionUtils.js's
// getVisibleIssues/getVisibleRequests: the same project-based scoping
// applies to both plain issues and isRequest=true requests, so callers
// filter by isRequest separately as a query param. What a user can SEE is
// decided by their role's scope; what they can DO is decided by permissions.
func IssueScopeFor(c *Claims) repository.VisibilityScope {
	switch c.Scope {
	case models.ScopeAll:
		return repository.VisibilityScope{All: true}
	case models.ScopeUnit:
		return repository.VisibilityScope{UnitID: c.UnitID}
	case models.ScopeManager:
		id := c.UserID
		return repository.VisibilityScope{ManagerID: &id}
	case models.ScopeProject:
		return repository.VisibilityScope{ProjectID: c.ProjectID}
	case models.ScopeOwn:
		id := c.UserID
		return repository.VisibilityScope{OwnOrVisible: &id}
	default:
		return repository.VisibilityScope{}
	}
}

// CanAccessProject reports whether the role's scope covers a project.
func CanAccessProject(c *Claims, project models.Project) bool {
	switch c.Scope {
	case models.ScopeAll:
		return true
	case models.ScopeUnit:
		return c.UnitID != nil && *c.UnitID == project.UnitID
	case models.ScopeManager:
		return c.UserID == project.ManagerID
	case models.ScopeProject:
		return c.ProjectID != nil && *c.ProjectID == project.ID
	default:
		return false
	}
}

// CanAccessIssue checks whether a role may see one specific issue: project
// scoping for the all/unit/manager/project scopes, or reporter/visibleTo
// membership for the "own" scope.
func CanAccessIssue(c *Claims, issue models.Issue, project models.Project) bool {
	if c.Scope != models.ScopeOwn {
		return CanAccessProject(c, project)
	}
	if issue.ReporterID == c.UserID {
		return true
	}
	for _, id := range issue.VisibleTo {
		if id == c.UserID {
			return true
		}
	}
	return false
}

// CanChangeAssignee needs the issue.assign permission; the reporter of an
// issue cannot assign it (even their own); and the issue's project must be
// inside the role's scope.
func CanChangeAssignee(c *Claims, issue models.Issue, project models.Project) bool {
	if !c.Can(PermIssueAssign) || issue.ReporterID == c.UserID {
		return false
	}
	return CanAccessProject(c, project)
}
