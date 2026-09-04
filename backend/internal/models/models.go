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
