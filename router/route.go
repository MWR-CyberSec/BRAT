package router

import (
	"github.com/Et43/BARK/config"
	"github.com/Et43/BARK/middleware"
	"github.com/casbin/casbin/v2"
	"github.com/gin-gonic/gin"
)

func InitRouter(init *config.Initialization) *gin.Engine {
	router := gin.New()
	router.Use(gin.Logger())
	router.Use(gin.Recovery())

	router.LoadHTMLGlob("templates/*/**")

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
	api.Use(middleware.JWTAuth()) // Apply JWT authentication to all API routes
	{
		user := api.Group("", authz)
		user.GET("", func(c *gin.Context) {
			c.HTML(200, "index.html", gin.H{})
		})

	}

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
