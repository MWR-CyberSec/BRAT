package service

import (
	"net/http"
	"strconv"

	"github.com/Et43/BARK/database/dao"
	"github.com/Et43/BARK/repository"
	"github.com/gin-gonic/gin"
	log "github.com/sirupsen/logrus"
)

type AgentService interface {
	GetAgents(*gin.Context)
	CreateAgent(*dao.Agent)
	GetAgentByID(*gin.Context)
	GetStagers(*gin.Context)
	SetStager(*gin.Context)
	ClearAgents(*gin.Context)
}

type AgentServiceImpl struct {
	agentsRepository repository.AgentRepository
}

func (s *AgentServiceImpl) GetAgents(c *gin.Context) {
	agents, err := s.agentsRepository.GetAll()
	if err != nil {
		log.Error(err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get agents"})
		return
	}
	c.JSON(http.StatusOK, agents)
}

func (s *AgentServiceImpl) ClearAgents(c *gin.Context) {
	// Clear all agents from the database

	// _, exists := c.Get("userRole")
	// println(exists)
	// println(c.Get("userRole"))
	// if !exists {
	// 	c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
	// 	return
	// }

	err := s.agentsRepository.ClearAgents()
	if err != nil {
		log.Error(err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to clear agents"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "agents cleared"})
}

func (s *AgentServiceImpl) CreateAgent(c *dao.Agent) {
	s.agentsRepository.CreateAgent(c)
}

func (s *AgentServiceImpl) GetAgentByID(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("agentID"))
	if err != nil {
		log.Error(err)
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid agent ID"})
		return
	}

	agent, err := s.agentsRepository.GetAgentByID(id)
	if err != nil {
		log.Error(err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get agent"})
		return
	}
	if agent == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "agent not found"})
		return
	}
	c.JSON(http.StatusOK, agent)
}

func (s *AgentServiceImpl) GetStagers(c *gin.Context) {
	stagers, err := s.agentsRepository.GetStagers()
	if err != nil {
		log.Error(err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get stagers"})
		return
	}
	c.JSON(http.StatusOK, stagers)
}

// Add the missing SetStager implementation
func (s *AgentServiceImpl) SetStager(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("agentID"))
	if err != nil {
		log.Error(err)
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid agent ID"})
		return
	}

	var request struct {
		IsStager bool `json:"is_stager"`
	}

	if err := c.ShouldBindJSON(&request); err != nil {
		log.Error(err)
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
		return
	}

	err = s.agentsRepository.SetStager(id, request.IsStager)
	if err != nil {
		log.Error(err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update stager status"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "stager status updated"})
}

func AgentServiceInit(agentsRepository repository.AgentRepository) *AgentServiceImpl {
	return &AgentServiceImpl{
		agentsRepository: agentsRepository,
	}
}
