package services

import (
	"context"
	"log"

	"github.com/google/uuid"

	"github.com/yasarsafali01/istakip/backend/internal/repository"
)

// Notifier creates in-app notifications, honouring each recipient's
// NotifyPush preference (the only channel actually delivered — email/SMS
// preferences are stored for a future integration but don't send anything
// yet). A failed notification never fails the action that triggered it.
type Notifier struct {
	notifications *repository.NotificationRepo
	users         *repository.UserRepo
}

func NewNotifier(notifications *repository.NotificationRepo, users *repository.UserRepo) *Notifier {
	return &Notifier{notifications: notifications, users: users}
}

const (
	NotifyAssigned  = "assigned"
	NotifyStatus    = "status_change"
	NotifyComment   = "comment"
	NotifyForwarded = "forwarded"
	NotifyRated     = "rated"
)

// Notify sends one notification if the recipient wants push notifications and
// isn't the actor causing it (no self-notifications).
func (n *Notifier) Notify(ctx context.Context, recipientID, actorID uuid.UUID, ntype, title, body string, issueID *uuid.UUID) {
	if recipientID == actorID {
		return
	}
	user, err := n.users.GetByID(ctx, recipientID)
	if err != nil || !user.NotifyPush {
		return
	}
	if err := n.notifications.Create(ctx, recipientID, ntype, title, body, issueID); err != nil {
		log.Printf("notification create failed: %v", err)
	}
}
