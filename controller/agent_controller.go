package controller

import (
	"github.com/Et43/BARK/database/dao"
	"github.com/Et43/BARK/service"
	"github.com/gin-gonic/gin"
)

type AgentController interface {
	GetAgents(*gin.Context)
	CreateAgent(*dao.Agent)
	GetAgentByID(*gin.Context)
	GetStagers(*gin.Context)
	SetStager(*gin.Context)
	ClearAgents(*gin.Context)
}

type AgentControllerImpl struct {
	agentService service.AgentService
}

func (u *AgentControllerImpl) ClearAgents(c *gin.Context) {
	u.agentService.ClearAgents(c)
}

func (u *AgentControllerImpl) GetAgents(c *gin.Context) {
	u.agentService.GetAgents(c)
}

func (u *AgentControllerImpl) CreateAgent(agent *dao.Agent) {
	u.agentService.CreateAgent(agent)
}

func (u *AgentControllerImpl) GetAgentByID(c *gin.Context) {
	u.agentService.GetAgentByID(c)
}

func (u *AgentControllerImpl) GetStagers(c *gin.Context) {
	u.agentService.GetStagers(c)
}

func (u *AgentControllerImpl) SetStager(c *gin.Context) {
	u.agentService.SetStager(c)
}

// Remove NewAgentController to avoid the double binding issue
// Keep only AgentControllerInit
func AgentControllerInit(agentService service.AgentService) *AgentControllerImpl {
	return &AgentControllerImpl{agentService: agentService}
}
