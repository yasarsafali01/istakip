package middleware

import (
	"context"
	"net/http"
	"strings"

	"github.com/yasarsafali01/istakip/backend/internal/response"
	"github.com/yasarsafali01/istakip/backend/internal/services"
)

type contextKey string

const claimsContextKey contextKey = "claims"

// RequireAuth validates the Bearer access token and stores its claims in the
// request context. Route-level role checks happen in individual handlers.
func RequireAuth(authService *services.AuthService) func(http.Handler) http.Handler {
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
