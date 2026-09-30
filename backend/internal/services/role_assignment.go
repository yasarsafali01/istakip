package services

import "github.com/yasarsafali01/istakip/backend/internal/models"

// CanManageUser reports whether the claims' role scope gives its holder
// management authority over the target user — used for role ASSIGNMENT
// delegation, which is a different question from issue/project visibility
// (see IssueScopeFor/CanAccessProject). targetProject is only needed (and
// may be nil otherwise) when the claims' scope is "manager".
func CanManageUser(c *Claims, target models.User, targetProject *models.Project) bool {
	switch c.Scope {
	case models.ScopeAll:
		return true
	case models.ScopeUnit:
		return c.UnitID != nil && target.UnitID != nil && *c.UnitID == *target.UnitID
	case models.ScopeManager:
		return targetProject != nil && targetProject.ManagerID == c.UserID
	default:
		return false
	}
}

// CanAssignRoleLevel enforces the hierarchy rule: you may only hand out a
// role strictly weaker than your own, and only to someone whose CURRENT role
// is also strictly weaker than yours (so you can never touch a peer or a
// superior, even one who happens to fall inside your organizational scope).
func CanAssignRoleLevel(assignerLevel, targetRoleLevel, targetCurrentLevel int) bool {
	return targetRoleLevel < assignerLevel && targetCurrentLevel < assignerLevel
}
