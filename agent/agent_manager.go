package agent

import (
	"os"
	"sync"
)

/*
*
* BARK Agent Manager
*
* This module is responsible for managing the BARK agents.
* It provides the necessary functionalities to create and manage the agent payloads.
*
 */

// AgentManagerInterface defines the interface for agent management
type AgentManagerInterface interface {
	GetAgentPayload() string
}

// AgentManagerImpl is the implementation of AgentManagerInterface
type AgentManagerImpl struct {
	sync.Mutex
}

func (am *AgentManagerImpl) GetAgentPayload() string {
	content, err := os.ReadFile("agent/agent.js")
	if err != nil {

		return `console.log("BARK Agent fallback activated");`
	}

	return string(content)
}

// For simpler use, also export a package-level function
func GetAgentPayload() string {
	return (&AgentManagerImpl{}).GetAgentPayload()
}

// Create a singleton instance for global use
var Manager AgentManagerInterface = &AgentManagerImpl{}
