package router

import (
	"github.com/Et43/BARK/config"
	"github.com/casbin/casbin/v2"
	"github.com/gin-gonic/gin"
)

func InitRouter(init *config.Initialization) *gin.Engine {

	db := config.InitDB()

	router := gin.New()
	router.Use(gin.Logger())
	router.Use(gin.Recovery())

	enforcer, err := casbin.NewEnforcer("config/rbac_model.conf", db)
	if err != nil {
		panic(err)
	}

	// Policies
	if hasPolicy, err := enforcer.HasPolicy("admin", "/api/user", "(GET)|(POST)|(PUT)|(DELETE)|(PATCH)"); !hasPolicy {
		enforcer.AddPolicy("admin", "/api/user", "(GET)|(POST)|(PUT)|(DELETE)|(PATCH)")
	} else if err != nil {
		panic(err)
	}

	if hasPolicy, err := enforcer.HasPolicy("user", "/api/user", "GET"); !hasPolicy {
		enforcer.AddPolicy("admin", "/api/user", "GET")
	} else if err != nil {
		panic(err)
	}

	api := router.Group("/api")
	{
		user := api.Group("/user")
		user.GET("", init.UserCtrl.GetAllUserData)
		user.POST("", init.UserCtrl.AddUserData)
		user.GET("/:id", init.UserCtrl.GetUserById)
		user.PUT("/:id", init.UserCtrl.UpdateUserData)
		user.DELETE("/:id", init.UserCtrl.DeleteUser)
	}

	return router

}
