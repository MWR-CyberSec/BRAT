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
	CreateAgent(*gin.Context)
	GetAgentByID(*gin.Context)
	GetStagers(*gin.Context)
	SetStager(*gin.Context)
}

type AgentServiceImpl struct {
	agentsRepository repository.AgentRepository
}

func (s AgentServiceImpl) GetAgents(c *gin.Context) {
	agents, err := s.agentsRepository.GetAll()
	if err != nil {
		log.Error(err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get agents"})
		return
	}
	c.JSON(http.StatusOK, agents)
}

func (s AgentServiceImpl) CreateAgent(c *gin.Context) {
	var request dao.Agent
	if err := c.ShouldBindJSON(&request); err != nil {
		log.Error(err)
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
		return
	}

	if request.Name == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "name is required"})
		return
	}

	if request.SourceIP == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "source IP is required"})
		return
	}

	s.agentsRepository.CreateAgent(&request)

	c.JSON(http.StatusCreated, request)
}

func (s AgentServiceImpl) GetAgentByID(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
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

func (s AgentServiceImpl) GetStagers(c *gin.Context) {
	stagers, err := s.agentsRepository.GetStagers()
	if err != nil {
		log.Error(err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get stagers"})
		return
	}
	c.JSON(http.StatusOK, stagers)
}

func AgentServiceInit(agentsRepository repository.AgentRepository) *AgentServiceImpl {
	return &AgentServiceImpl{
		agentsRepository: agentsRepository,
	}
}
