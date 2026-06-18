// Package auth provides JWT authentication for admin routes.
//
// Features:
//   - JWT token generation and validation
//   - Password hashing with bcrypt
//   - HTTP middleware for protected routes
//   - Admin user management
package auth

import (
	"context"
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v4"
	"golang.org/x/crypto/bcrypt"
)

// Context key for storing admin user in request context
type contextKey string

const AdminUserKey contextKey = "adminUser"

// AdminUser represents an authenticated admin user.
type AdminUser struct {
	ID       int    `json:"id"`
	Username string `json:"username"`
	Email    string `json:"email"`
}

// Claims represents the JWT claims structure.
type Claims struct {
	UserID   int    `json:"userId"`
	Username string `json:"username"`
	jwt.RegisteredClaims
}

// AuthService handles authentication operations.
type AuthService struct {
	db        *sql.DB
	jwtSecret []byte
}

// NewAuthService creates a new authentication service.
func NewAuthService(db *sql.DB, jwtSecret string) *AuthService {
	secret := []byte(jwtSecret)
	if len(secret) == 0 {
		// Generate random secret if not provided (development only)
		secret = make([]byte, 32)
		rand.Read(secret)
	}
	return &AuthService{db: db, jwtSecret: secret}
}

// HashPassword hashes a password using bcrypt.
func HashPassword(password string) (string, error) {
	bytes, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	return string(bytes), err
}

// CheckPassword compares a password with a hash.
func CheckPassword(password, hash string) bool {
	err := bcrypt.CompareHashAndPassword([]byte(hash), []byte(password))
	return err == nil
}

// GenerateToken creates a new JWT token for an admin user.
func (s *AuthService) GenerateToken(userID int, username string) (string, error) {
	claims := &Claims{
		UserID:   userID,
		Username: username,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(24 * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			Issuer:    "desayuno-backend",
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(s.jwtSecret)
}

// ValidateToken validates a JWT token and returns the claims.
func (s *AuthService) ValidateToken(tokenString string) (*Claims, error) {
	token, err := jwt.ParseWithClaims(tokenString, &Claims{}, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, errors.New("invalid signing method")
		}
		return s.jwtSecret, nil
	})

	if err != nil {
		return nil, err
	}

	if claims, ok := token.Claims.(*Claims); ok && token.Valid {
		return claims, nil
	}

	return nil, errors.New("invalid token")
}

// Login authenticates a user and returns a JWT token.
func (s *AuthService) Login(username, password string) (string, *AdminUser, error) {
	var user AdminUser
	var passwordHash string

	err := s.db.QueryRow(
		"SELECT id, username, email, password_hash FROM admin_users WHERE username = ? AND deleted_at IS NULL",
		username,
	).Scan(&user.ID, &user.Username, &user.Email, &passwordHash)

	if err == sql.ErrNoRows {
		return "", nil, errors.New("invalid credentials")
	}
	if err != nil {
		return "", nil, err
	}

	if !CheckPassword(password, passwordHash) {
		return "", nil, errors.New("invalid credentials")
	}

	token, err := s.GenerateToken(user.ID, user.Username)
	if err != nil {
		return "", nil, err
	}

	return token, &user, nil
}

// Middleware returns an HTTP middleware that validates JWT tokens.
// Protected routes will have the admin user in the request context.
func (s *AuthService) Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Get token from Authorization header
		authHeader := r.Header.Get("Authorization")
		if authHeader == "" {
			http.Error(w, `{"error":"missing authorization header"}`, http.StatusUnauthorized)
			return
		}

		// Extract Bearer token
		parts := strings.Split(authHeader, " ")
		if len(parts) != 2 || parts[0] != "Bearer" {
			http.Error(w, `{"error":"invalid authorization header"}`, http.StatusUnauthorized)
			return
		}

		// Validate token
		claims, err := s.ValidateToken(parts[1])
		if err != nil {
			http.Error(w, `{"error":"invalid token"}`, http.StatusUnauthorized)
			return
		}

		// Add admin user to context
		user := &AdminUser{
			ID:       claims.UserID,
			Username: claims.Username,
		}
		ctx := context.WithValue(r.Context(), AdminUserKey, user)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// GetAdminUser retrieves the admin user from the request context.
func GetAdminUser(r *http.Request) *AdminUser {
	user, _ := r.Context().Value(AdminUserKey).(*AdminUser)
	return user
}

// GenerateSecureToken generates a cryptographically secure random token.
func GenerateSecureToken(length int) string {
	bytes := make([]byte, length)
	rand.Read(bytes)
	return hex.EncodeToString(bytes)
}
