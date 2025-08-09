package repository

import (
	"errors"

	"github.com/Et43/BARK/database/dao"
	"gorm.io/gorm"
)

type AgentRepository interface {
	CreateAgent(agent *dao.Agent) error
	GetAgentByID(id int) (*dao.Agent, error)
	GetAll() ([]dao.Agent, error)
	SetStager(name string, isStager bool) error
	GetStagers() ([]dao.Agent, error)
	ClearAgents() error
	GetAgentByName(name string) (*dao.Agent, error)
	UpdateAgent(agent *dao.Agent) error
}

type AgentRepositoryImpl struct {
	db *gorm.DB
}

func (r *AgentRepositoryImpl) GetAgentByName(name string) (*dao.Agent, error) {
	var agent dao.Agent
	result := r.db.Where("name = ?", name).First(&agent)
	if result.Error != nil {
		if errors.Is(result.Error, gorm.ErrRecordNotFound) {
			return nil, errors.New("agent not found")
		}
		return nil, result.Error
	}
	return &agent, nil
}

func (r *AgentRepositoryImpl) CreateAgent(agent *dao.Agent) error {
	return r.db.Create(agent).Error
}

func (r *AgentRepositoryImpl) ClearAgents() error {
	var agents []dao.Agent
	result := r.db.Find(&agents)
	if result.Error != nil {
		return result.Error
	}

	for _, agent := range agents {
		if err := r.db.Delete(&agent).Error; err != nil {
			return err
		}
	}
	return nil
}

func (r *AgentRepositoryImpl) GetAgentByID(id int) (*dao.Agent, error) {
	var agent dao.Agent
	result := r.db.First(&agent, id)
	if result.Error != nil {
		if errors.Is(result.Error, gorm.ErrRecordNotFound) {
			return nil, nil // Agent not found
		}
		return nil, result.Error // Other error
	}
	return &agent, nil
}

func (r *AgentRepositoryImpl) GetAll() ([]dao.Agent, error) {
	var agents []dao.Agent
	result := r.db.Find(&agents)
	if result.Error != nil {
		return nil, result.Error
	}
	return agents, nil
}

func (r *AgentRepositoryImpl) SetStager(name string, isStager bool) error {
	var agent dao.Agent
	result := r.db.Where("name = ?", name).First(&agent)
	if result.Error != nil {
		if errors.Is(result.Error, gorm.ErrRecordNotFound) {
			return nil // Agent not found
		}
		return result.Error // Other error
	}

	// Update the IsStager field
	agent.IsStager = isStager
	return r.db.Save(&agent).Error
}

func (r *AgentRepositoryImpl) GetStagers() ([]dao.Agent, error) {
	var agents []dao.Agent
	result := r.db.Where("is_stager = ?", true).Find(&agents)
	if result.Error != nil {
		return nil, result.Error
	}
	return agents, nil
}

func (r *AgentRepositoryImpl) UpdateAgent(agent *dao.Agent) error {
	return r.db.Save(agent).Error
}

func AgentRepositoryInit(db *gorm.DB) *AgentRepositoryImpl {
	return &AgentRepositoryImpl{db: db}
}
