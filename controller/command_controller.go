package controller

import (
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/Et43/BARK/service"
	"github.com/gin-gonic/gin"
	log "github.com/sirupsen/logrus"
)

type CommandController interface {
	QueueCommand(c *gin.Context)
	GetPendingCommands(c *gin.Context)
	GetCommandHistory(c *gin.Context)
	RemoveCompletedCommand(c *gin.Context)
	ClearAllCommands(c *gin.Context)

	GetLatestRemoteView(c *gin.Context)
	GetRemoteViewHistory(c *gin.Context)
}

type CommandControllerImpl struct {
	commandService service.CommandService
}

func (c *CommandControllerImpl) ClearAllCommands(ctx *gin.Context) {
	err := c.commandService.ClearAllCommands()
	if err != nil {
		log.Error("Failed to clear commands: ", err)
		ctx.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Failed to clear commands",
			"details": err.Error(),
		})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{
		"message": "All commands cleared successfully",
	})
}

func (c *CommandControllerImpl) QueueCommand(ctx *gin.Context) {
	agentID := ctx.Param("agentID")

	var request struct {
		Command string `json:"command" binding:"required"`
	}

	if err := ctx.ShouldBindJSON(&request); err != nil {
		log.Error("Failed to bind JSON: ", err)
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request payload"})
		return
	}

	cmd, err := c.commandService.QueueCommand(agentID, request.Command)
	println("Command queued: ", request.Command)
	if err != nil {
		log.Error("Failed to queue command: ", err)
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to queue command"})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"command": cmd})
}

func (c *CommandControllerImpl) GetPendingCommands(ctx *gin.Context) {
	agentID := ctx.Param("agentID")

	// Add debug output
	fmt.Printf("Getting pending commands for agent: %s\n", agentID)

	commands, err := c.commandService.GetPendingCommands(agentID)
	if err != nil {
		log.Error("Failed to get pending commands: ", err)
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get pending commands"})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"commands": commands})
}

func (c *CommandControllerImpl) GetCommandHistory(ctx *gin.Context) {
	agentID := ctx.Param("agentID")

	// Add debug output
	fmt.Printf("Getting command history for agent: %s\n", agentID)

	commands, err := c.commandService.GetCommandHistory(agentID)
	if err != nil {
		log.Error("Failed to get command history: ", err)
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get command history"})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"commands": commands})
}

// GetLatestRemoteView retrieves the latest remote view data for an agent
func (c *CommandControllerImpl) GetLatestRemoteView(ctx *gin.Context) {
	agentID := ctx.Param("agentID")

	data, err := c.commandService.GetLatestRemoteViewData(agentID)
	if err != nil {
		log.Error("Failed to get remote view data: ", err)
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get remote view data"})
		return
	}

	// Try to parse the result to a JSON object for the response
	var resultObj interface{}
	if err := json.Unmarshal([]byte(data), &resultObj); err == nil {
		ctx.JSON(http.StatusOK, gin.H{"remoteView": resultObj})
	} else {
		// If parsing fails, return the raw string
		ctx.JSON(http.StatusOK, gin.H{"remoteView": data})
	}
}

// GetRemoteViewHistory retrieves the history of remote view data for an agent
func (c *CommandControllerImpl) GetRemoteViewHistory(ctx *gin.Context) {
	agentID := ctx.Param("agentID")

	history, err := c.commandService.GetRemoteViewHistory(agentID)
	if err != nil {
		log.Error("Failed to get remote view history: ", err)
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get remote view history"})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"history": history})
}

// RemoveCompletedCommand removes a completed command from the history
func (c *CommandControllerImpl) RemoveCompletedCommand(ctx *gin.Context) {
	agentID := ctx.Param("agentID")
	commandID := ctx.Param("commandID")

	err := c.commandService.RemoveCompletedCommand(agentID, commandID)
	if err != nil {
		log.Error("Failed to remove completed command: ", err)
		ctx.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Failed to remove completed command",
			"details": err.Error(),
		})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{
		"message": fmt.Sprintf("Command %s removed from history", commandID),
	})
}

func CommandControllerInit(commandService service.CommandService) *CommandControllerImpl {
	return &CommandControllerImpl{commandService: commandService}
}
