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
	Key         Role   `json:"key"`
	Name        string `json:"name"`
	Description string `json:"description"`
	Scope       Scope  `json:"scope"`
	// Level is authority rank: higher = more senior. Determines which roles
	// this role's holders may hand to someone else (see services.CanAssignRole)
	// — strictly below their own level, independent of the permission set.
	Level       int      `json:"level"`
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
	// Additional roles on top of Role; effective access is the union.
	ExtraRoles []Role `json:"extraRoles"`
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
	Level       int      `json:"level,omitempty"`
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
	Key         string      `json:"key"` // UnitCode + "-" + ProjectKey + "-" + Number, computed via join
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
	// First move to In Progress — splits the total time into waiting
	// (created→started) and resolution (started→resolved).
	StartedAt *time.Time `json:"startedAt,omitempty"`

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

	// The request form (talep türü) the request was opened with, and the
	// answers to its questions — both snapshots captured at creation.
	RequestFormID   *uuid.UUID      `json:"requestFormId,omitempty"`
	RequestFormName *string         `json:"requestFormName,omitempty"`
	RequestAnswers  []RequestAnswer `json:"requestAnswers"`

	// Set while the issue is "Onay Bekliyor": the completion a user without
	// issue.approve submitted, applied only when a manager approves it.
	PendingCompletion *PendingCompletion `json:"pendingCompletion,omitempty"`
}

// StatusPendingApproval: completed by someone who can't close work alone;
// waits for a manager (issue.approve) to approve or reject.
const StatusPendingApproval = "Onay Bekliyor"

type PendingCompletion struct {
	ResolutionNote string     `json:"resolutionNote"`
	EquipmentID    *uuid.UUID `json:"equipmentId,omitempty"`
	Quantity       int        `json:"quantity,omitempty"`
	SubmittedBy    uuid.UUID  `json:"submittedBy"`
	SubmittedAt    time.Time  `json:"submittedAt"`
}

// RequestForm is one "talep türü" of a project: a named list of questions.
// A project may have several; a requester picks one after the project.
type RequestForm struct {
	ID          uuid.UUID         `json:"id"`
	ProjectID   uuid.UUID         `json:"projectId"`
	Name        string            `json:"name"`
	Description string            `json:"description"`
	IsActive    bool              `json:"isActive"`
	SortOrder   int               `json:"sortOrder"`
	CreatedAt   time.Time         `json:"createdAt"`
	Questions   []RequestQuestion `json:"questions"`
}

// Request form question types.
const (
	QuestionText     = "text"     // single-line input
	QuestionTextarea = "textarea" // multi-line input
	QuestionNumber   = "number"
	QuestionDate     = "date"
	QuestionSelect   = "select"   // dropdown, one option
	QuestionRadio    = "radio"    // radio buttons, one option
	QuestionCheckbox = "checkbox" // checkbox group, any number of options
	QuestionBoolean  = "boolean"  // single yes/no checkbox (e.g. consent)
	QuestionFile     = "file"     // file upload(s)
)

// QuestionSettings holds type-specific options. File questions: MaxFiles
// (1-10) and Accept (file categories, see services.FileCategories; empty =
// any allowed category).
type QuestionSettings struct {
	MaxFiles int      `json:"maxFiles,omitempty"`
	Accept   []string `json:"accept,omitempty"`
}

// QuestionCondition shows a question only when an earlier select/radio/
// boolean question's answer equals Value ("true"/"false" for boolean).
type QuestionCondition struct {
	QuestionID uuid.UUID `json:"questionId"`
	Value      string    `json:"value"`
}

// RequestQuestion is one field of a request form, designed by the project's
// manager and shown to requesters after they pick that form.
type RequestQuestion struct {
	ID          uuid.UUID          `json:"id"`
	FormID      uuid.UUID          `json:"formId"`
	Label       string             `json:"label"`
	HelpText    string             `json:"helpText"`
	Placeholder string             `json:"placeholder"`
	Type        string             `json:"type"`
	Options     []string           `json:"options"`
	Required    bool               `json:"required"`
	SortOrder   int                `json:"sortOrder"`
	ShowIf      *QuestionCondition `json:"showIf"`
	// Share of a 12-column row: 12 full, 6 half, 4 third, 3 quarter.
	Width    int              `json:"width"`
	Settings QuestionSettings `json:"settings"`
}

// RequestFile is a file uploaded for a file question; IssueID is set once the
// request is created (until then only the uploader can see it).
type RequestFile struct {
	ID           uuid.UUID  `json:"id"`
	UploaderID   uuid.UUID  `json:"uploaderId"`
	IssueID      *uuid.UUID `json:"issueId,omitempty"`
	OriginalName string     `json:"name"`
	ContentType  string     `json:"contentType"`
	SizeBytes    int64      `json:"size"`
	StorageName  string     `json:"-"`
	CreatedAt    time.Time  `json:"createdAt"`
}

// FileRef is how a file answer is stored in a request's answer snapshot.
type FileRef struct {
	ID   uuid.UUID `json:"id"`
	Name string    `json:"name"`
	Size int64     `json:"size"`
}

// RequestAnswer is a snapshot (label + type copied in) so a request keeps
// reading correctly after its question is edited or deleted. Value is a
// string, []string (checkbox) or bool (boolean).
type RequestAnswer struct {
	QuestionID uuid.UUID   `json:"questionId"`
	Label      string      `json:"label"`
	Type       string      `json:"type"`
	Value      interface{} `json:"value"`
}

type Team struct {
	ID        uuid.UUID   `json:"id"`
	ProjectID uuid.UUID   `json:"projectId"`
	Name      string      `json:"name"`
	CreatedAt time.Time   `json:"createdAt"`
	MemberIDs []uuid.UUID `json:"memberIds"`
}

// Template kinds: canned comment replies, and resolution notes used when
// completing a request.
const (
	TemplateReply      = "reply"
	TemplateResolution = "resolution"
)

type ReplyTemplate struct {
	ID        uuid.UUID `json:"id"`
	ProjectID uuid.UUID `json:"projectId"`
	Kind      string    `json:"kind"`
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
