package service

import (
	"context"
	"encoding/json"
	"fmt"
	"strconv"
	"time"

	"github.com/Et43/BARK/constant"
	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
)

type CommandService interface {
	QueueCommand(agentID string, command string) (*constant.QueuedCommand, error)
	GetPendingCommands(agentID string) ([]*constant.QueuedCommand, error)
	DequeueCommand(agentID string) (*constant.QueuedCommand, error)
	UpdateCommandStatus(agentID string, commandID string, status string, response string) error
	GetCommandHistory(agentID string) ([]*constant.QueuedCommand, error)
	ClearAllCommands() error
}

type CommandServiceImpl struct {
	redisClient *redis.Client
}

func (s *CommandServiceImpl) ClearAllCommands() error {
	ctx := context.Background()

	keys, err := s.redisClient.Keys(ctx, "agent:*:commands:*").Result()
	if err != nil {
		return fmt.Errorf("failed to get command keys: %w", err)
	}

	for _, key := range keys {
		err := s.redisClient.Del(ctx, key).Err()
		if err != nil {
			return fmt.Errorf("failed to delete key %s: %w", key, err)
		}
	}

	return nil
}

func getCommandQueueKey(agentID string) string {
	return fmt.Sprintf("agent:%s:commands:queue", agentID)
}

func getCommandHistoryKey(agentID string) string {
	return fmt.Sprintf("agent:%s:commands:history", agentID)
}

// QueueCommand queues a command for a specific agent
func (s *CommandServiceImpl) QueueCommand(agentID string, command string) (*constant.QueuedCommand, error) {
	ctx := context.Background()

	cmd := constant.QueuedCommand{
		ID:        uuid.New().String(),
		Command:   command,
		CreatedAt: time.Now(),
		Status:    "pending",
		Response:  "",
	}

	fmt.Printf("Queueing command: %+v\n", cmd)

	cmdJSON, err := json.Marshal(cmd)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal command: %w", err)
	}

	queueKey := getCommandQueueKey(agentID)
	err = s.redisClient.RPush(ctx, queueKey, string(cmdJSON)).Err()
	if err != nil {
		return nil, fmt.Errorf("failed to queue command: %w", err)
	}

	return &cmd, nil
}

// GetPendingCommands retrieves all pending commands for a specific agent
func (s *CommandServiceImpl) GetPendingCommands(agentID string) ([]*constant.QueuedCommand, error) {
	ctx := context.Background()

	queueKey := getCommandQueueKey(agentID)
	cmdsJSON, err := s.redisClient.LRange(ctx, queueKey, 0, -1).Result()
	if err != nil {
		return nil, fmt.Errorf("failed to get pending commands: %w", err)
	}

	commands := make([]*constant.QueuedCommand, 0, len(cmdsJSON))
	for _, cmdJSON := range cmdsJSON {
		var cmd constant.QueuedCommand
		if err := json.Unmarshal([]byte(cmdJSON), &cmd); err != nil {
			return nil, fmt.Errorf("failed to unmarshal command: %w", err)
		}
		commands = append(commands, &cmd)
	}

	fmt.Printf("Pending commands for agent %s: %v\n", agentID, commands)
	return commands, nil
}

// DequeueCommand removes and returns the oldest command for an agent
func (s *CommandServiceImpl) DequeueCommand(agentID string) (*constant.QueuedCommand, error) {
	ctx := context.Background()

	// Try first with the direct agent ID as provided
	queueKey := getCommandQueueKey(agentID)
	fmt.Printf("Attempting to dequeue command using key: '%s'\n", queueKey)

	cmdJSON, err := s.redisClient.LPop(ctx, queueKey).Result()
	if err != nil && err != redis.Nil {
		// Real error occurred
		return nil, fmt.Errorf("failed to dequeue command: %w", err)
	}

	// Found a command, process it
	if err == nil && cmdJSON != "" {
		var cmd constant.QueuedCommand
		if err := json.Unmarshal([]byte(cmdJSON), &cmd); err != nil {
			return nil, fmt.Errorf("failed to unmarshal command: %w", err)
		}

		cmd.Status = "sent"
		fmt.Printf("Command dequeued for agent '%s': %s\n", agentID, cmd.Command)

		// Add command to history
		if err := s.addToCommandHistory(agentID, cmd); err != nil {
			fmt.Printf("Warning: failed to add command to history: %v\n", err)
		}

		return &cmd, nil
	}

	// No commands found with the direct ID, let's try to check if this is
	// a database ID and maybe commands were queued with the agent name
	if _, err := strconv.ParseInt(agentID, 10, 64); err == nil {
		// This looks like a numeric database ID, let's try to retrieve the agent
		// This is the inverse of what we're doing in route.go
		// This is just a defensive measure in case commands were queued
		// with agent names but we're checking with database IDs

		// We can't directly access the agent service/repo here, so just log a warning
		fmt.Printf("Agent ID '%s' looks like a database ID, but no commands found. Commands might be queued with agent name instead.\n", agentID)
		return nil, nil
	}

	// No commands found
	return nil, nil
}

// UpdateCommandStatus updates the status of a command in history
func (s *CommandServiceImpl) UpdateCommandStatus(agentID string, commandID string, status string, response string) error {
	ctx := context.Background()

	historyKey := getCommandHistoryKey(agentID)
	cmdsJSON, err := s.redisClient.LRange(ctx, historyKey, 0, -1).Result()
	if err != nil {
		return fmt.Errorf("failed to get command history: %w", err)
	}

	for i, cmdJSON := range cmdsJSON {
		var cmd constant.QueuedCommand
		if err := json.Unmarshal([]byte(cmdJSON), &cmd); err != nil {
			continue
		}

		if cmd.ID == commandID {
			cmd.Status = status
			cmd.Response = response
			if status == "completed" || status == "failed" {
				cmd.CompletedAt = time.Now()
			}

			updatedJSON, err := json.Marshal(cmd)
			if err != nil {
				return fmt.Errorf("failed to marshal updated command: %w", err)
			}

			err = s.redisClient.LSet(ctx, historyKey, int64(i), string(updatedJSON)).Err()
			if err != nil {
				return fmt.Errorf("failed to update command status: %w", err)
			}

			return nil
		}
	}

	return fmt.Errorf("command not found in history")
}

// GetCommandHistory retrieves the command history for a specific agent
func (s *CommandServiceImpl) GetCommandHistory(agentID string) ([]*constant.QueuedCommand, error) {
	ctx := context.Background()

	historyKey := getCommandHistoryKey(agentID)
	cmdsJSON, err := s.redisClient.LRange(ctx, historyKey, 0, -1).Result()
	if err != nil {
		return nil, fmt.Errorf("failed to get command history: %w", err)
	}

	commands := make([]*constant.QueuedCommand, 0, len(cmdsJSON))
	for _, cmdJSON := range cmdsJSON {
		var cmd constant.QueuedCommand
		if err := json.Unmarshal([]byte(cmdJSON), &cmd); err != nil {
			continue
		}
		commands = append(commands, &cmd)
	}

	return commands, nil
}

// Helper to add a command to history
func (s *CommandServiceImpl) addToCommandHistory(agentID string, cmd constant.QueuedCommand) error {
	ctx := context.Background()

	historyKey := getCommandHistoryKey(agentID)
	cmdJSON, err := json.Marshal(cmd)
	if err != nil {
		return fmt.Errorf("failed to marshal command: %w", err)
	}

	fmt.Printf("Adding command to history: %s\n", cmdJSON)

	err = s.redisClient.LPush(ctx, historyKey, string(cmdJSON)).Err()
	if err != nil {
		return fmt.Errorf("failed to add command to history: %w", err)
	}

	// Keep only last 100 commands
	err = s.redisClient.LTrim(ctx, historyKey, 0, 99).Err()
	if err != nil {
		// Non-critical error, just log it
		fmt.Printf("Warning: failed to trim command history: %v\n", err)
	}

	return nil
}

// Constructor
func CommandServiceInit(redisClient *redis.Client) *CommandServiceImpl {
	return &CommandServiceImpl{
		redisClient: redisClient,
	}
}
