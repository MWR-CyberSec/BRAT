package controller

import (
	"github.com/Et43/BARK/service"
	"github.com/gin-gonic/gin"
)

type AgentController interface {
	GetAgents(*gin.Context)
	CreateAgent(*gin.Context)
	GetAgentByID(*gin.Context)
	GetStagers(*gin.Context)
	SetStager(*gin.Context)
}

type AgentControllerImpl struct {
	agentService service.AgentService
}

func (u *AgentControllerImpl) GetAgents(c *gin.Context) {
	u.agentService.GetAgents(c)
}

func (u *AgentControllerImpl) CreateAgent(c *gin.Context) {
	u.agentService.CreateAgent(c)
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

func NewAgentController(agentService service.AgentService) AgentController {
	return &AgentControllerImpl{agentService: agentService}
}
