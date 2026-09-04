package services

import (
	"github.com/yasarsafali01/istakip/backend/internal/models"
	"github.com/yasarsafali01/istakip/backend/internal/repository"
)

// IssueScopeFor mirrors frontend/src/utils/permissionUtils.js's
// getVisibleIssues/getVisibleRequests: the same project-based scoping
// applies to both plain issues and isRequest=true requests, so callers
// filter by isRequest separately as a query param.
func IssueScopeFor(c *Claims) repository.VisibilityScope {
	switch c.Role {
	case models.RoleSystemAdmin:
		return repository.VisibilityScope{All: true}
	case models.RoleDepartmentHead:
		return repository.VisibilityScope{UnitID: c.UnitID}
	case models.RoleProjectManager:
		id := c.UserID
		return repository.VisibilityScope{ManagerID: &id}
	case models.RoleWorker:
		return repository.VisibilityScope{ProjectID: c.ProjectID}
	case models.RoleExternalUser:
		id := c.UserID
		return repository.VisibilityScope{OwnOrVisible: &id}
	default:
		return repository.VisibilityScope{}
	}
}

// CanAccessIssue checks whether a role may see one specific issue: project
// scoping for System_Admin/Department_Head/Project_Manager/Worker, or
// reporter/visibleTo membership for External_User.
func CanAccessIssue(c *Claims, issue models.Issue, project models.Project) bool {
	switch c.Role {
	case models.RoleSystemAdmin:
		return true
	case models.RoleDepartmentHead:
		return c.UnitID != nil && *c.UnitID == project.UnitID
	case models.RoleProjectManager:
		return c.UserID == project.ManagerID
	case models.RoleWorker:
		return c.ProjectID != nil && *c.ProjectID == project.ID
	case models.RoleExternalUser:
		if issue.ReporterID == c.UserID {
			return true
		}
		for _, id := range issue.VisibleTo {
			if id == c.UserID {
				return true
			}
		}
		return false
	default:
		return false
	}
}

// CanChangeAssignee mirrors canChangeAssignee: External_User never can; the
// reporter of an issue cannot assign it (even their own); System_Admin
// always can; Department_Head/Project_Manager can within their own
// unit/project.
func CanChangeAssignee(c *Claims, issue models.Issue, project models.Project) bool {
	if c.Role == models.RoleExternalUser {
		return false
	}
	if issue.ReporterID == c.UserID {
		return false
	}
	switch c.Role {
	case models.RoleSystemAdmin:
		return true
	case models.RoleDepartmentHead:
		return c.UnitID != nil && *c.UnitID == project.UnitID
	case models.RoleProjectManager:
		return c.UserID == project.ManagerID
	default:
		return false
	}
}
