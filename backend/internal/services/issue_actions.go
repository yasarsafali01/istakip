package services

import "github.com/yasarsafali01/istakip/backend/internal/models"

// Issue action rules. The issue handlers enforce these and every issue
// response carries their result (models.IssueActions), so web and mobile
// show exactly the buttons the backend will accept instead of re-implementing
// the rules client-side.

var terminalStatuses = map[string]bool{
	"Done": true, "Geri Çevrildi": true, "İptal Edildi": true, "Yönlendirildi": true,
}

// IsTerminalStatus reports whether a request is closed for good.
func IsTerminalStatus(status string) bool { return terminalStatuses[status] }

func isOwnRequest(c *Claims, issue models.Issue) bool {
	return issue.IsRequest && issue.ReporterID == c.UserID
}

// CanModifyIssue: the permission, the issue within scope, and a requester
// (own scope) only ever acts on their own request.
func CanModifyIssue(c *Claims, permission string, issue models.Issue, project models.Project) bool {
	if !c.Can(permission) {
		return false
	}
	if c.Scope == models.ScopeOwn && !isOwnRequest(c, issue) {
		return false
	}
	return CanAccessIssue(c, issue, project)
}

// CanChangeStatus needs issue.status on an issue in scope; a rejected request
// stays closed, and an issue waiting for completion approval only moves with
// issue.approve.
func CanChangeStatus(c *Claims, issue models.Issue, project models.Project) bool {
	if !c.Can(PermIssueStatus) || !CanAccessIssue(c, issue, project) || issue.Status == "Geri Çevrildi" {
		return false
	}
	return issue.Status != models.StatusPendingApproval || c.Can(PermIssueApprove)
}

// IssueActionsFor computes what the caller may do with one issue.
func IssueActionsFor(c *Claims, issue models.Issue, project models.Project) models.IssueActions {
	access := CanAccessIssue(c, issue, project)
	own := isOwnRequest(c, issue)
	terminal := IsTerminalStatus(issue.Status)
	changeStatus := CanChangeStatus(c, issue, project)
	assign := CanChangeAssignee(c, issue, project)

	return models.IssueActions{
		Edit:         CanModifyIssue(c, PermIssueEdit, issue, project),
		Delete:       CanModifyIssue(c, PermIssueDelete, issue, project) && issue.ReporterID == c.UserID,
		ChangeStatus: changeStatus,
		Complete:     changeStatus && issue.Status != "Done" && issue.Status != models.StatusPendingApproval && !terminal,
		Approve:      c.Can(PermIssueApprove) && access && issue.Status == models.StatusPendingApproval,
		Assign:       assign,
		Reject:       changeStatus && assign,
		Forward:      issue.IsRequest && c.Can(PermIssueForward) && access && !terminal,
		Cancel:       own && access && !terminal,
		Rate:         own && access && issue.Status == "Done" && issue.RatedAt == nil,
		Clone:        CanModifyIssue(c, PermIssueClone, issue, project),
		Share:        c.Can(PermIssueShare) && access,
		MoveSprint:   c.Can(PermIssueSprint) && CanAccessProject(c, project),
		EditDates:    c.Can(PermIssueDates) && access,
		Comment:      access,
	}
}
