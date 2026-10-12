package middleware

import (
	"context"
	"net/http"
	"strings"

	"github.com/yasarsafali01/istakip/backend/internal/models"
	"github.com/yasarsafali01/istakip/backend/internal/repository"
	"github.com/yasarsafali01/istakip/backend/internal/response"
	"github.com/yasarsafali01/istakip/backend/internal/services"
)

type contextKey string

const claimsContextKey contextKey = "claims"

// RequireAuth validates the Bearer access token and stores its claims in the
// request context. Route-level role checks happen in individual handlers.
func RequireAuth(authService *services.AuthService, roles *services.RoleStore, teams *repository.TeamRepo, users *repository.UserRepo) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			header := r.Header.Get("Authorization")
			token, ok := strings.CutPrefix(header, "Bearer ")
			if !ok || token == "" {
				response.Error(w, http.StatusUnauthorized, "missing bearer token")
				return
			}

			claims, err := authService.ParseAccessToken(token)
			if err != nil {
				response.Error(w, http.StatusUnauthorized, "invalid or expired token")
				return
			}

			// Scope and permissions come from the role store, not the token, so a
			// role edit (or a deleted role) takes effect on the very next request.
			if !roles.Apply(claims) {
				response.Error(w, http.StatusForbidden, "Rolünüz artık geçerli değil")
				return
			}

			// all/unit scopes already see every team of their daire başkanlığı,
			// so only narrower scopes need the membership lookup.
			if claims.Scope != models.ScopeAll && claims.Scope != models.ScopeUnit {
				memberships, err := teams.MembershipsOf(r.Context(), claims.UserID)
				if err != nil {
					response.Error(w, http.StatusInternalServerError, "failed to load teams")
					return
				}
				for _, m := range memberships {
					claims.TeamIDs = append(claims.TeamIDs, m.TeamID)
					claims.TeamProjectIDs = append(claims.TeamProjectIDs, m.ProjectID)
				}
				if claims.ProjectIDs, err = users.ProjectIDsOf(r.Context(), claims.UserID); err != nil {
					response.Error(w, http.StatusInternalServerError, "failed to load projects")
					return
				}
			}

			ctx := context.WithValue(r.Context(), claimsContextKey, claims)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// CurrentClaims returns the authenticated user's claims from the request
// context. It only returns ok=false if called on a route not wrapped by
// RequireAuth, which is a programming error.
func CurrentClaims(ctx context.Context) (*services.Claims, bool) {
	claims, ok := ctx.Value(claimsContextKey).(*services.Claims)
	return claims, ok
}
