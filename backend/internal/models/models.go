package models

import (
	"time"

	"github.com/google/uuid"
)

type Role string

const (
	RoleSystemAdmin    Role = "System_Admin"
	RoleDepartmentHead Role = "Department_Head"
	RoleProjectManager Role = "Project_Manager"
	RoleWorker         Role = "Worker"
	RoleExternalUser   Role = "External_User"
)

// Scope is how much data a role can see (independent of what it may do).
type Scope string

const (
	ScopeAll     Scope = "all"     // everything
	ScopeUnit    Scope = "unit"    // the user's own unit
	ScopeManager Scope = "manager" // projects the user manages
	ScopeProject Scope = "project" // the user's assigned project
	ScopeOwn     Scope = "own"     // only requests the user opened or was given
)

// RoleDef is a configurable role: a named permission set plus a data scope.
type RoleDef struct {
	Key         Role     `json:"key"`
	Name        string   `json:"name"`
	Description string   `json:"description"`
	Scope       Scope    `json:"scope"`
	IsSystem    bool     `json:"isSystem"`
	Permissions []string `json:"permissions"`
	UserCount   int      `json:"userCount"`
}

type User struct {
	ID           uuid.UUID  `json:"id"`
	Name         string     `json:"name"`
	Email        string     `json:"email"`
	PasswordHash string     `json:"-"`
	Role         Role       `json:"role"`
	UnitID       *uuid.UUID `json:"unitId,omitempty"`
	ProjectID    *uuid.UUID `json:"projectId,omitempty"`
	AvatarColor  string     `json:"avatarColor"`
	CreatedAt    time.Time  `json:"createdAt"`
	// Profile location — where to find this person in the building (helpdesk use).
	Building *string `json:"building,omitempty"`
	Floor    *string `json:"floor,omitempty"`
	Room     *string `json:"room,omitempty"`
	// Notification channel preferences. Only "push" (in-app) is actually wired
	// up; email/SMS are stored for a future integration and otherwise inert.
	NotifyEmail bool `json:"notifyEmail"`
	NotifySMS   bool `json:"notifySms"`
	NotifyPush  bool `json:"notifyPush"`
	// Filled in for /auth/login and /users/me only.
	Scope       Scope    `json:"scope,omitempty"`
	Permissions []string `json:"permissions,omitempty"`
}

type Unit struct {
	ID               uuid.UUID  `json:"id"`
	Name             string     `json:"name"`
	UnitCode         string     `json:"unitCode"`
	DepartmentHeadID *uuid.UUID `json:"departmentHeadId,omitempty"`
	CreatedAt        time.Time  `json:"createdAt"`
}

type Project struct {
	ID              uuid.UUID `json:"id"`
	Key             string    `json:"key"`
	Name            string    `json:"name"`
	Description     string    `json:"description"`
	UnitID          uuid.UUID `json:"unitId"`
	ManagerID       uuid.UUID `json:"managerId"`
	HasInventory    bool      `json:"hasInventory"`
	NextIssueNumber int       `json:"-"`
	CreatedAt       time.Time `json:"createdAt"`
}

type SprintStatus string

const (
	SprintPlanned   SprintStatus = "Planned"
	SprintActive    SprintStatus = "Active"
	SprintCompleted SprintStatus = "Completed"
)

type Sprint struct {
	ID        uuid.UUID    `json:"id"`
	ProjectID uuid.UUID    `json:"projectId"`
	Name      string       `json:"name"`
	Month     int          `json:"month"`
	Year      int          `json:"year"`
	StartDate time.Time    `json:"startDate"`
	EndDate   time.Time    `json:"endDate"`
	Status    SprintStatus `json:"status"`
}

type Issue struct {
	ID          uuid.UUID   `json:"id"`
	Number      int         `json:"number"`
	ProjectID   uuid.UUID   `json:"projectId"`
	ProjectKey  string      `json:"projectKey"`
	Key         string      `json:"key"` // ProjectKey + "-" + Number, computed via join
	SprintID    *uuid.UUID  `json:"sprintId,omitempty"`
	Title       string      `json:"title"`
	Description string      `json:"description"`
	Type        string      `json:"type"`
	Priority    string      `json:"priority"`
	Status      string      `json:"status"`
	AssigneeID  *uuid.UUID  `json:"assigneeId,omitempty"`
	ReporterID  uuid.UUID   `json:"reporterId"`
	IsRequest   bool        `json:"isRequest"`
	VisibleTo   []uuid.UUID `json:"visibleTo"`
	TimeSpent   int         `json:"timeSpent"`
	CreatedAt   time.Time   `json:"createdAt"`
	UpdatedAt   time.Time   `json:"updatedAt"`
	ResolvedAt  *time.Time  `json:"resolvedAt,omitempty"`

	// Requester's satisfaction rating for a resolved request (1-5), set once.
	Rating        *int16     `json:"rating,omitempty"`
	RatingComment *string    `json:"ratingComment,omitempty"`
	RatedAt       *time.Time `json:"ratedAt,omitempty"`

	// Helpdesk walk-in/phone requests: who actually needs help, when staff
	// opens the request on that person's behalf (that person has no account).
	ContactName  *string `json:"contactName,omitempty"`
	ContactPhone *string `json:"contactPhone,omitempty"`

	// Set when a request is routed to a different project (Yönlendirildi).
	ForwardedFromProjectID *uuid.UUID `json:"forwardedFromProjectId,omitempty"`

	// Alternative to AssigneeID — assign a whole team instead of one person.
	AssigneeTeamID *uuid.UUID `json:"assigneeTeamId,omitempty"`
}

type Team struct {
	ID        uuid.UUID   `json:"id"`
	ProjectID uuid.UUID   `json:"projectId"`
	Name      string      `json:"name"`
	CreatedAt time.Time   `json:"createdAt"`
	MemberIDs []uuid.UUID `json:"memberIds"`
}

type ReplyTemplate struct {
	ID        uuid.UUID `json:"id"`
	ProjectID uuid.UUID `json:"projectId"`
	Title     string    `json:"title"`
	Body      string    `json:"body"`
	SortOrder int       `json:"sortOrder"`
	IsActive  bool      `json:"isActive"`
	CreatedAt time.Time `json:"createdAt"`
}

type Notification struct {
	ID        uuid.UUID  `json:"id"`
	UserID    uuid.UUID  `json:"userId"`
	Type      string     `json:"type"`
	Title     string     `json:"title"`
	Body      string     `json:"body"`
	IssueID   *uuid.UUID `json:"issueId,omitempty"`
	CreatedAt time.Time  `json:"createdAt"`
	ReadAt    *time.Time `json:"readAt,omitempty"`
}

type Comment struct {
	ID        uuid.UUID `json:"id"`
	IssueID   uuid.UUID `json:"issueId"`
	AuthorID  uuid.UUID `json:"authorId"`
	Text      string    `json:"text"`
	CreatedAt time.Time `json:"createdAt"`
}

type Activity struct {
	ID          uuid.UUID `json:"id"`
	IssueID     uuid.UUID `json:"issueId"`
	UserID      uuid.UUID `json:"userId"`
	Type        string    `json:"type"`
	Description string    `json:"description"`
	CreatedAt   time.Time `json:"createdAt"`
}

type InventoryItem struct {
	ID        uuid.UUID `json:"id"`
	ProjectID uuid.UUID `json:"projectId"`
	Name      string    `json:"name"`
	Quantity  int       `json:"quantity"`
	Unit      string    `json:"unit"`
}
