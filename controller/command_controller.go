package controller

import (
	"net/http"

	"github.com/Et43/BARK/service"
	"github.com/gin-gonic/gin"
	log "github.com/sirupsen/logrus"

	"fmt"
)

type CommandController interface {
	QueueCommand(c *gin.Context)
	GetPendingCommands(c *gin.Context)
	GetCommandHistory(c *gin.Context)
	ClearAllCommands(c *gin.Context)
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

func CommandControllerInit(commandService service.CommandService) *CommandControllerImpl {
	return &CommandControllerImpl{commandService: commandService}
}
