package services

import (
	"context"
	"sort"
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
	// userRoles overrides the role embedded in the access token: primary role
	// first, then any extra roles.
	userRoles map[uuid.UUID][]models.Role
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

// scopeRank orders scopes from narrowest to widest; with several roles the
// widest one decides what the user can see.
var scopeRank = map[models.Scope]int{
	models.ScopeOwn: 1, models.ScopeProject: 2, models.ScopeManager: 3, models.ScopeUnit: 4, models.ScopeAll: 5,
}

// Effective is the combined access of a set of roles.
type Effective struct {
	Scope       models.Scope
	Level       int
	Permissions []string
}

// Resolve combines a primary role and extra roles: union of permissions,
// widest scope, highest level. ok=false when the primary role is gone; an
// extra role that no longer exists is skipped.
func (s *RoleStore) Resolve(primary models.Role, extra []models.Role) (Effective, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	base, ok := s.roles[primary]
	if !ok {
		return Effective{}, false
	}
	eff := Effective{Scope: base.Scope, Level: base.Level}
	perms := map[string]bool{}
	for _, p := range base.Permissions {
		perms[p] = true
	}
	for _, key := range extra {
		d, ok := s.roles[key]
		if !ok {
			continue
		}
		if scopeRank[d.Scope] > scopeRank[eff.Scope] {
			eff.Scope = d.Scope
		}
		if d.Level > eff.Level {
			eff.Level = d.Level
		}
		for _, p := range d.Permissions {
			perms[p] = true
		}
	}
	eff.Permissions = make([]string, 0, len(perms))
	for p := range perms {
		eff.Permissions = append(eff.Permissions, p)
	}
	sort.Strings(eff.Permissions)
	return eff, true
}

// Apply fills the claims' scope, level and permission set from the user's
// current roles. It returns false when the primary role no longer exists.
func (s *RoleStore) Apply(c *Claims) bool {
	var extra []models.Role
	s.mu.RLock()
	if current, ok := s.userRoles[c.UserID]; ok && len(current) > 0 {
		c.Role = current[0]
		extra = current[1:]
	}
	s.mu.RUnlock()

	eff, ok := s.Resolve(c.Role, extra)
	if !ok {
		return false
	}
	c.Scope = eff.Scope
	c.Level = eff.Level
	c.Perms = make(map[string]bool, len(eff.Permissions))
	for _, p := range eff.Permissions {
		c.Perms[p] = true
	}
	return true
}

// Decorate adds the effective scope, level and permissions to a user's
// profile for the client.
func (s *RoleStore) Decorate(u *models.User) {
	if eff, ok := s.Resolve(u.Role, u.ExtraRoles); ok {
		u.Scope = eff.Scope
		u.Level = eff.Level
		u.Permissions = eff.Permissions
	}
}
