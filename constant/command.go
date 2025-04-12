package constant

import "time"

type QueuedCommand struct {
	ID          string    `json:"id"`           // Unique command ID
	Command     string    `json:"command"`      // Command syntax following [MODULE].[COMMAND].(VALUES) format
	CreatedAt   time.Time `json:"created_at"`   // When command was queued
	Status      string    `json:"status"`       // "pending", "sent", "completed", "failed"
	Response    string    `json:"response"`     // Agent's response (when completed)
	CompletedAt time.Time `json:"completed_at"` // When command was completed
}
