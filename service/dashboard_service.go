package service

import (
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
)

type DashboardService interface {
	ShowDashboard(c *gin.Context)
}

type DashboardServiceImpl struct {
	agentService AgentService
}

func (d *DashboardServiceImpl) ShowDashboard(c *gin.Context) {
	// Add null check for safety
	if d.agentService == nil {
		c.JSON(500, gin.H{"error": "Agent service not initialized"})
		return
	}

	agentID := c.Param("agentID")

	id, err := strconv.Atoi(agentID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid agent ID"})
		return
	}

	// Check if the GetAgentByIDInternal method exists
	agent, err := d.agentService.GetAgentByIDInternal(id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve agent"})
		return
	}

	if agent == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Agent not found"})
		return
	}

	c.HTML(http.StatusOK, "dashboard", gin.H{
		"agent": agent,
		"now":   time.Now(),
	})
}

// Make sure the service init function accepts the agent service
func DashboardServiceInit(agentService AgentService) *DashboardServiceImpl {
	// Log or print to verify
	if agentService == nil {
		panic("agentService cannot be nil")
	}

	return &DashboardServiceImpl{
		agentService: agentService,
	}
}
