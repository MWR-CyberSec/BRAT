package repository

import (
	"errors"

	"github.com/Et43/BARK/database/dao"
	"gorm.io/gorm"
)

type AgentRepository struct {
	db *gorm.DB
}

func AgentRepositoryImpl(db *gorm.DB) *AgentRepository {
	return &AgentRepository{db: db}
}

func (r *AgentRepository) CreateAgent(agent *dao.Agent) error {
	return r.db.Create(agent).Error
}

func (r *AgentRepository) GetAgentByID(id int) (*dao.Agent, error) {
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

func (r *AgentRepository) GetAll() ([]dao.Agent, error) {
	var agents []dao.Agent
	result := r.db.Find(&agents)
	if result.Error != nil {
		return nil, result.Error
	}
	return agents, nil
}

func (r *AgentRepository) SetStager(id int, isStager bool) error {
	var agent dao.Agent
	result := r.db.First(&agent, id)
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

func (r *AgentRepository) GetStagers() ([]dao.Agent, error) {
	var agents []dao.Agent
	result := r.db.Where("is_stager = ?", true).Find(&agents)
	if result.Error != nil {
		return nil, result.Error
	}
	return agents, nil
}
