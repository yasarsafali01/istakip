package services

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"

	"github.com/yasarsafali01/istakip/backend/internal/models"
	"github.com/yasarsafali01/istakip/backend/internal/repository"
)

// ErrInvalidCredentials is returned for both "user not found" and "wrong
// password" so callers can show one generic message (enumeration protection —
// mirrors the original frontend's authUtils.js behaviour).
var ErrInvalidCredentials = errors.New("invalid credentials")

var ErrInvalidRefreshToken = errors.New("invalid refresh token")

type Claims struct {
	UserID    uuid.UUID   `json:"sub"`
	Role      models.Role `json:"role"`
	UnitID    *uuid.UUID  `json:"unitId,omitempty"`
	ProjectID *uuid.UUID  `json:"projectId,omitempty"`
	jwt.RegisteredClaims
}

type AuthService struct {
	users         *repository.UserRepo
	refreshTokens *repository.RefreshTokenRepo
	secret        []byte
	accessTTL     time.Duration
	refreshTTL    time.Duration
}

func NewAuthService(users *repository.UserRepo, refreshTokens *repository.RefreshTokenRepo, secret string, accessTTL, refreshTTL time.Duration) *AuthService {
	return &AuthService{
		users:         users,
		refreshTokens: refreshTokens,
		secret:        []byte(secret),
		accessTTL:     accessTTL,
		refreshTTL:    refreshTTL,
	}
}

type TokenPair struct {
	AccessToken  string
	RefreshToken string
}

func (s *AuthService) Login(ctx context.Context, email, password string) (models.User, TokenPair, error) {
	user, err := s.users.GetByEmail(ctx, email)
	if errors.Is(err, repository.ErrNotFound) {
		return models.User{}, TokenPair{}, ErrInvalidCredentials
	}
	if err != nil {
		return models.User{}, TokenPair{}, err
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(password)); err != nil {
		return models.User{}, TokenPair{}, ErrInvalidCredentials
	}

	pair, err := s.issueTokenPair(ctx, user)
	if err != nil {
		return models.User{}, TokenPair{}, err
	}
	return user, pair, nil
}

func (s *AuthService) Refresh(ctx context.Context, refreshToken string) (TokenPair, error) {
	hash := hashToken(refreshToken)

	userID, err := s.refreshTokens.GetActiveUserID(ctx, hash)
	if errors.Is(err, repository.ErrNotFound) {
		return TokenPair{}, ErrInvalidRefreshToken
	}
	if err != nil {
		return TokenPair{}, err
	}

	user, err := s.users.GetByID(ctx, userID)
	if err != nil {
		return TokenPair{}, err
	}

	// Rotate: revoke the used refresh token and issue a new pair.
	if err := s.refreshTokens.Revoke(ctx, hash); err != nil {
		return TokenPair{}, err
	}
	return s.issueTokenPair(ctx, user)
}

func (s *AuthService) Logout(ctx context.Context, refreshToken string) error {
	return s.refreshTokens.Revoke(ctx, hashToken(refreshToken))
}

func (s *AuthService) ParseAccessToken(tokenStr string) (*Claims, error) {
	claims := &Claims{}
	token, err := jwt.ParseWithClaims(tokenStr, claims, func(t *jwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, errors.New("unexpected signing method")
		}
		return s.secret, nil
	})
	if err != nil || !token.Valid {
		return nil, errors.New("invalid access token")
	}
	return claims, nil
}

func (s *AuthService) issueTokenPair(ctx context.Context, user models.User) (TokenPair, error) {
	now := time.Now()
	claims := &Claims{
		UserID:    user.ID,
		Role:      user.Role,
		UnitID:    user.UnitID,
		ProjectID: user.ProjectID,
		RegisteredClaims: jwt.RegisteredClaims{
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(now.Add(s.accessTTL)),
			Subject:   user.ID.String(),
		},
	}
	accessToken, err := jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString(s.secret)
	if err != nil {
		return TokenPair{}, err
	}

	refreshToken, err := generateRefreshToken()
	if err != nil {
		return TokenPair{}, err
	}
	if err := s.refreshTokens.Create(ctx, user.ID, hashToken(refreshToken), now.Add(s.refreshTTL)); err != nil {
		return TokenPair{}, err
	}

	return TokenPair{AccessToken: accessToken, RefreshToken: refreshToken}, nil
}

func generateRefreshToken() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(b), nil
}

func hashToken(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}
