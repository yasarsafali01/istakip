package services

import (
	"context"
	"sync"

	"github.com/google/uuid"

	"github.com/yasarsafali01/istakip/backend/internal/models"
	"github.com/yasarsafali01/istakip/backend/internal/repository"
)

// RoleStore caches every role's scope and permission set so each request can
// resolve its role without hitting the database. Handlers that change roles
// call Reload, so edits apply immediately.
type RoleStore struct {
	repo  *repository.RoleRepo
	mu    sync.RWMutex
	roles map[models.Role]models.RoleDef
	// userRoles overrides the role embedded in the access token.
	userRoles map[uuid.UUID]models.Role
}

func NewRoleStore(repo *repository.RoleRepo) *RoleStore {
	return &RoleStore{repo: repo, roles: map[models.Role]models.RoleDef{}}
}

func (s *RoleStore) Reload(ctx context.Context) error {
	all, err := s.repo.List(ctx)
	if err != nil {
		return err
	}
	m := make(map[models.Role]models.RoleDef, len(all))
	for _, d := range all {
		m[d.Key] = d
	}
	ur, err := s.repo.UserRoles(ctx)
	if err != nil {
		return err
	}
	s.mu.Lock()
	s.roles = m
	s.userRoles = ur
	s.mu.Unlock()
	return nil
}

func (s *RoleStore) Get(key models.Role) (models.RoleDef, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	d, ok := s.roles[key]
	return d, ok
}

// Apply fills the claims' scope and permission set from the user's role.
// It returns false when the role no longer exists.
func (s *RoleStore) Apply(c *Claims) bool {
	s.mu.RLock()
	if current, ok := s.userRoles[c.UserID]; ok {
		c.Role = current
	}
	s.mu.RUnlock()
	d, ok := s.Get(c.Role)
	if !ok {
		return false
	}
	c.Scope = d.Scope
	c.Perms = make(map[string]bool, len(d.Permissions))
	for _, p := range d.Permissions {
		c.Perms[p] = true
	}
	return true
}

// Decorate adds scope and permissions to a user's profile for the client.
func (s *RoleStore) Decorate(u *models.User) {
	if d, ok := s.Get(u.Role); ok {
		u.Scope = d.Scope
		u.Permissions = d.Permissions
	}
}
