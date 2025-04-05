package agent

import (
	"os"
	"strings"
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
	GetAgentPayload(agentID string) string
}

// AgentManagerImpl is the implementation of AgentManagerInterface
type AgentManagerImpl struct {
	sync.Mutex
}

func (am *AgentManagerImpl) GetAgentPayload(agentID string) string {
	content, err := os.ReadFile("agent/agent.js")
	if err != nil {

		return `console.log("BARK Agent fallback activated");`
	}

	stringContent := string(content)

	stringContent = strings.ReplaceAll(string(stringContent), "__BARK_AGENT_ID__", agentID)

	return string(stringContent)
}

// For simpler use, also export a package-level function
func GetAgentPayload(agentID string) string {
	return (&AgentManagerImpl{}).GetAgentPayload(agentID)
}

// Create a singleton instance for global use
var Manager AgentManagerInterface = &AgentManagerImpl{}
