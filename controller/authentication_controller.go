package controller

import (
	"github.com/Et43/BARK/service"
	"github.com/gin-gonic/gin"
)

type AuthController interface {
	Login(c *gin.Context)
	Register(c *gin.Context)
}

type AuthControllerImpl struct {
	svc service.AuthService
}

func (a AuthControllerImpl) Login(c *gin.Context) {
	a.svc.Login(c)
}

func (a AuthControllerImpl) Register(c *gin.Context) {
	a.svc.Register(c)
}

func AuthControllerInit(authService service.AuthService) *AuthControllerImpl {
	return &AuthControllerImpl{svc: authService}
}
