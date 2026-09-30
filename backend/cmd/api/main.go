package main

import (
	"context"
	"encoding/json"
	"log"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/yasarsafali01/istakip/backend/internal/config"
	"github.com/yasarsafali01/istakip/backend/internal/db"
	"github.com/yasarsafali01/istakip/backend/internal/handlers"
	authmw "github.com/yasarsafali01/istakip/backend/internal/middleware"
	"github.com/yasarsafali01/istakip/backend/internal/repository"
	"github.com/yasarsafali01/istakip/backend/internal/services"
)

func main() {
	cfg := config.Load()

	var pool *pgxpool.Pool
	if cfg.DatabaseURL != "" {
		p, err := db.NewPool(context.Background(), cfg.DatabaseURL)
		if err != nil {
			log.Fatalf("database connection failed: %v", err)
		}
		defer p.Close()
		pool = p
		log.Println("connected to database")
	} else {
		log.Println("DATABASE_URL not set — starting without a database connection")
	}

	r := chi.NewRouter()
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   cfg.CORSOrigins,
		AllowedMethods:   []string{"GET", "POST", "PATCH", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Content-Type", "Authorization"},
		AllowCredentials: true,
		MaxAge:           300,
	}))

	r.Get("/health", healthHandler(pool))

	if pool != nil {
		userRepo := repository.NewUserRepo(pool)
		refreshTokenRepo := repository.NewRefreshTokenRepo(pool)
		authService := services.NewAuthService(userRepo, refreshTokenRepo, cfg.JWTSecret, cfg.JWTAccessTTL, cfg.JWTRefreshTTL)

		unitRepo := repository.NewUnitRepo(pool)
		projectRepo := repository.NewProjectRepo(pool)

		roleRepo := repository.NewRoleRepo(pool)
		roleStore := services.NewRoleStore(roleRepo)
		if err := roleStore.Reload(context.Background()); err != nil {
			log.Fatalf("loading roles failed (run migrations?): %v", err)
		}
		roleHandler := handlers.NewRoleHandler(roleRepo, userRepo, projectRepo, roleStore)

		authHandler := handlers.NewAuthHandler(authService, roleStore)

		r.Route("/auth", func(r chi.Router) {
			r.Post("/login", authHandler.Login)
			r.Post("/refresh", authHandler.Refresh)
			r.Post("/logout", authHandler.Logout)
		})

		unitHandler := handlers.NewUnitHandler(unitRepo)
		projectHandler := handlers.NewProjectHandler(projectRepo, unitRepo)
		sprintHandler := handlers.NewSprintHandler(repository.NewSprintRepo(pool), projectRepo)

		issueRepo := repository.NewIssueRepo(pool)
		activityRepo := repository.NewActivityRepo(pool)
		commentRepo := repository.NewCommentRepo(pool)
		inventoryRepo := repository.NewInventoryRepo(pool)
		teamRepo := repository.NewTeamRepo(pool)
		templateRepo := repository.NewReplyTemplateRepo(pool)
		notificationRepo := repository.NewNotificationRepo(pool)
		notifier := services.NewNotifier(notificationRepo, userRepo)

		issueHandler := handlers.NewIssueHandler(issueRepo, projectRepo, activityRepo, userRepo, notifier)
		commentHandler := handlers.NewCommentHandler(commentRepo, issueRepo, projectRepo, activityRepo, notifier)
		activityHandler := handlers.NewActivityHandler(activityRepo, issueRepo, projectRepo)
		inventoryHandler := handlers.NewInventoryHandler(inventoryRepo, projectRepo)
		userHandler := handlers.NewUserHandler(userRepo, roleStore)
		teamHandler := handlers.NewTeamHandler(teamRepo, projectRepo)
		templateHandler := handlers.NewReplyTemplateHandler(templateRepo, projectRepo)
		notificationHandler := handlers.NewNotificationHandler(notificationRepo)

		r.Group(func(r chi.Router) {
			r.Use(authmw.RequireAuth(authService, roleStore))

			r.Route("/units", func(r chi.Router) {
				r.Get("/", unitHandler.List)
				r.Post("/", unitHandler.Create)
				r.Patch("/{id}", unitHandler.Update)
			})

			r.Route("/projects", func(r chi.Router) {
				r.Get("/", projectHandler.List)
				r.Post("/", projectHandler.Create)
				r.Get("/{id}", projectHandler.Get)
				r.Patch("/{id}", projectHandler.Update)

				r.Get("/{id}/sprints", sprintHandler.List)
				r.Post("/{id}/sprints", sprintHandler.Create)

				r.Get("/{id}/inventory", inventoryHandler.List)
				r.Post("/{id}/inventory", inventoryHandler.Create)

				r.Get("/{id}/teams", teamHandler.List)
				r.Post("/{id}/teams", teamHandler.Create)

				r.Get("/{id}/reply-templates", templateHandler.List)
				r.Post("/{id}/reply-templates", templateHandler.Create)
			})

			r.Route("/teams", func(r chi.Router) {
				r.Patch("/{id}", teamHandler.Rename)
				r.Delete("/{id}", teamHandler.Delete)
				r.Post("/{id}/members", teamHandler.AddMember)
				r.Delete("/{id}/members/{userId}", teamHandler.RemoveMember)
			})

			r.Route("/reply-templates", func(r chi.Router) {
				r.Patch("/{id}", templateHandler.Update)
				r.Delete("/{id}", templateHandler.Delete)
			})

			r.Route("/notifications", func(r chi.Router) {
				r.Get("/", notificationHandler.List)
				r.Get("/unread-count", notificationHandler.UnreadCount)
				r.Post("/{id}/read", notificationHandler.MarkRead)
				r.Post("/read-all", notificationHandler.MarkAllRead)
			})

			r.Route("/sprints", func(r chi.Router) {
				r.Post("/{id}/start", sprintHandler.Start)
				r.Post("/{id}/complete", sprintHandler.Complete)
			})

			r.Route("/issues", func(r chi.Router) {
				r.Get("/", issueHandler.List)
				r.Post("/", issueHandler.Create)
				r.Get("/{id}", issueHandler.Get)
				r.Patch("/{id}", issueHandler.Update)
				r.Delete("/{id}", issueHandler.Delete)
				r.Patch("/{id}/status", issueHandler.UpdateStatus)
				r.Post("/{id}/complete", issueHandler.Complete)
				r.Patch("/{id}/assignee", issueHandler.UpdateAssignee)
				r.Patch("/{id}/dates", issueHandler.UpdateDates)
				r.Post("/{id}/visible-users", issueHandler.AddVisibleUser)
				r.Post("/{id}/clone", issueHandler.Clone)
				r.Post("/{id}/move-sprint", issueHandler.MoveSprint)
				r.Post("/{id}/forward", issueHandler.Forward)
				r.Post("/{id}/cancel", issueHandler.Cancel)
				r.Post("/{id}/rate", issueHandler.Rate)
				r.Get("/{id}/comments", commentHandler.List)
				r.Post("/{id}/comments", commentHandler.Create)
				r.Get("/{id}/activities", activityHandler.List)
			})

			r.Delete("/comments/{id}", commentHandler.Delete)
			r.Patch("/inventory/{id}", inventoryHandler.Adjust)

			r.Route("/users", func(r chi.Router) {
				r.Get("/", userHandler.List)
				r.Get("/me", userHandler.Me)
				r.Patch("/me", userHandler.UpdateMe)
				r.Post("/me/change-password", userHandler.ChangePassword)
				r.Patch("/{id}/role", roleHandler.AssignUserRole)
			})

			r.Get("/permissions", roleHandler.Permissions)
			r.Route("/roles", func(r chi.Router) {
				r.Get("/", roleHandler.List)
				r.Post("/", roleHandler.Create)
				r.Patch("/{key}", roleHandler.Update)
				r.Delete("/{key}", roleHandler.Delete)
			})
		})
	}

	log.Printf("listening on :%s", cfg.Port)
	if err := http.ListenAndServe(":"+cfg.Port, r); err != nil {
		log.Fatalf("server failed: %v", err)
	}
}

func healthHandler(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		status := "ok"
		dbStatus := "not_configured"
		if pool != nil {
			if err := pool.Ping(r.Context()); err != nil {
				status = "degraded"
				dbStatus = "unreachable"
			} else {
				dbStatus = "connected"
			}
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{
			"status":   status,
			"database": dbStatus,
		})
	}
}
