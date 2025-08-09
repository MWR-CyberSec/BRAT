package service

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/Et43/BARK/repository"
	"github.com/gin-gonic/gin"
	"github.com/redis/go-redis/v9"
	log "github.com/sirupsen/logrus"
	"golang.org/x/net/context"
)

type DebugService interface {
	GetDebugDashboard(*gin.Context)
	GetRedisQueueData(*gin.Context)
	GetAgentDebugData(*gin.Context)
	GetSystemHealth(*gin.Context)
	GetWebSocketConnections(*gin.Context)
	FlushRedisQueues(*gin.Context)
	TestDatabaseConnection(*gin.Context)
}

type DebugServiceImpl struct {
	agentRepository repository.AgentRepository
	redisClient     *redis.Client
	commandService  CommandService
}

type RedisQueueData struct {
	QueueName    string `json:"queue_name"`
	CommandCount int64  `json:"command_count"`
	Commands     []struct {
		AgentID   string `json:"agent_id"`
		Command   string `json:"command"`
		Timestamp string `json:"timestamp"`
	} `json:"commands"`
}

type AgentDebugData struct {
	ID           int    `json:"id"`
	Name         string `json:"name"`
	IsStager     bool   `json:"is_stager"`
	SourceIP     string `json:"source_ip"`
	SystemInfo   string `json:"system_info"`
	Capabilities string `json:"capabilities"`
	Version      string `json:"version"`
	CreatedAt    string `json:"created_at"`
	UpdatedAt    string `json:"updated_at"`
}

type SystemHealth struct {
	DatabaseStatus string `json:"database_status"`
	RedisStatus    string `json:"redis_status"`
	TotalAgents    int64  `json:"total_agents"`
	ActiveStagers  int64  `json:"active_stagers"`
	FullAgents     int64  `json:"full_agents"`
	TotalCommands  int64  `json:"total_commands"`
	Timestamp      string `json:"timestamp"`
}

func (s *DebugServiceImpl) GetDebugDashboard(c *gin.Context) {
	c.HTML(http.StatusOK, "debug_dashboard.tmpl", gin.H{
		"title": "BARK Debug Dashboard",
	})
}

func (s *DebugServiceImpl) GetRedisQueueData(c *gin.Context) {
	ctx := context.Background()

	// Get all keys that match the command queue pattern
	keys, err := s.redisClient.Keys(ctx, "command_queue:*").Result()
	if err != nil {
		log.Error("Error getting Redis keys:", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get Redis queue data"})
		return
	}

	var queues []RedisQueueData

	for _, key := range keys {
		// Get queue length
		length, err := s.redisClient.LLen(ctx, key).Result()
		if err != nil {
			log.Error("Error getting queue length:", err)
			continue
		}

		// Get commands in queue
		commands, err := s.redisClient.LRange(ctx, key, 0, -1).Result()
		if err != nil {
			log.Error("Error getting commands from queue:", err)
			continue
		}

		queueData := RedisQueueData{
			QueueName:    key,
			CommandCount: length,
			Commands: make([]struct {
				AgentID   string `json:"agent_id"`
				Command   string `json:"command"`
				Timestamp string `json:"timestamp"`
			}, 0),
		}

		// Parse commands
		for _, cmd := range commands {
			var commandData map[string]interface{}
			if err := json.Unmarshal([]byte(cmd), &commandData); err == nil {
				queueData.Commands = append(queueData.Commands, struct {
					AgentID   string `json:"agent_id"`
					Command   string `json:"command"`
					Timestamp string `json:"timestamp"`
				}{
					AgentID:   fmt.Sprintf("%v", commandData["agent_id"]),
					Command:   fmt.Sprintf("%v", commandData["command"]),
					Timestamp: fmt.Sprintf("%v", commandData["timestamp"]),
				})
			}
		}

		queues = append(queues, queueData)
	}

	c.JSON(http.StatusOK, gin.H{
		"queues":    queues,
		"timestamp": time.Now().Format(time.RFC3339),
	})
}

func (s *DebugServiceImpl) GetAgentDebugData(c *gin.Context) {
	agents, err := s.agentRepository.GetAll()
	if err != nil {
		log.Error("Error getting agents:", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get agent data"})
		return
	}

	var debugData []AgentDebugData
	for _, agent := range agents {
		debugData = append(debugData, AgentDebugData{
			ID:           agent.ID,
			Name:         agent.Name,
			IsStager:     agent.IsStager,
			SourceIP:     agent.SourceIP,
			SystemInfo:   agent.SystemInfo,
			Capabilities: agent.Capabilities,
			Version:      agent.Version,
			CreatedAt:    agent.CreatedAt.Format(time.RFC3339),
			UpdatedAt:    agent.UpdatedAt.Format(time.RFC3339),
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"agents":    debugData,
		"count":     len(debugData),
		"timestamp": time.Now().Format(time.RFC3339),
	})
}

func (s *DebugServiceImpl) GetSystemHealth(c *gin.Context) {
	ctx := context.Background()
	health := SystemHealth{
		Timestamp: time.Now().Format(time.RFC3339),
	}

	// Check database status
	agents, err := s.agentRepository.GetAll()
	if err != nil {
		health.DatabaseStatus = "ERROR: " + err.Error()
	} else {
		health.DatabaseStatus = "OK"
		health.TotalAgents = int64(len(agents))

		for _, agent := range agents {
			if agent.IsStager {
				health.ActiveStagers++
			} else {
				health.FullAgents++
			}
		}
	}

	// Check Redis status
	_, err = s.redisClient.Ping(ctx).Result()
	if err != nil {
		health.RedisStatus = "ERROR: " + err.Error()
	} else {
		health.RedisStatus = "OK"

		// Count total commands in all queues
		keys, err := s.redisClient.Keys(ctx, "command_queue:*").Result()
		if err == nil {
			for _, key := range keys {
				length, err := s.redisClient.LLen(ctx, key).Result()
				if err == nil {
					health.TotalCommands += length
				}
			}
		}
	}

	c.JSON(http.StatusOK, health)
}

func (s *DebugServiceImpl) GetWebSocketConnections(c *gin.Context) {
	// This would need to be implemented with a connection tracker
	// For now, return a placeholder
	c.JSON(http.StatusOK, gin.H{
		"active_connections": 0,
		"message":            "WebSocket connection tracking not implemented yet",
		"timestamp":          time.Now().Format(time.RFC3339),
	})
}

func (s *DebugServiceImpl) FlushRedisQueues(c *gin.Context) {
	ctx := context.Background()

	// Get all command queue keys
	keys, err := s.redisClient.Keys(ctx, "command_queue:*").Result()
	if err != nil {
		log.Error("Error getting Redis keys:", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get Redis keys"})
		return
	}

	var deletedCount int
	for _, key := range keys {
		err := s.redisClient.Del(ctx, key).Err()
		if err != nil {
			log.Error("Error deleting key:", key, err)
		} else {
			deletedCount++
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"message":       "Redis queues flushed successfully",
		"deleted_count": deletedCount,
		"timestamp":     time.Now().Format(time.RFC3339),
	})
}

func (s *DebugServiceImpl) TestDatabaseConnection(c *gin.Context) {
	// Test database connection by trying to get all agents
	agents, err := s.agentRepository.GetAll()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"status":    "ERROR",
			"message":   err.Error(),
			"timestamp": time.Now().Format(time.RFC3339),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status":      "OK",
		"message":     "Database connection successful",
		"agent_count": len(agents),
		"timestamp":   time.Now().Format(time.RFC3339),
	})
}

func DebugServiceInit(agentRepository repository.AgentRepository, redisClient *redis.Client, commandService CommandService) *DebugServiceImpl {
	return &DebugServiceImpl{
		agentRepository: agentRepository,
		redisClient:     redisClient,
		commandService:  commandService,
	}
}
