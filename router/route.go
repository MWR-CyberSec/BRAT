package router

import (
	"github.com/Et43/BARK/config"
	"github.com/gin-gonic/gin"
)

func InitRouter(init *config.Initialization) *gin.Engine {

	router := gin.New()
	router.Use(gin.Logger())
	router.Use(gin.Recovery())

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
