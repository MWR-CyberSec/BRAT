package config

import (
	"github.com/Et43/BARK/controller"
	"github.com/Et43/BARK/repository"
	"github.com/Et43/BARK/service"
)

type Initialization struct { // <-- Fixed typo here (was Initalization)
	userRepo repository.UserRepository
	userSvc  service.UserService
	UserCtrl controller.UserController
	AuthCtrl controller.AuthController
}

func NewInitialization(userRepo repository.UserRepository,
	userSvc service.UserService,
	userCtrl controller.UserController, authCtrl controller.AuthController) *Initialization { // <-- Fixed return type here
	return &Initialization{ // <-- Fixed type here
		userRepo: userRepo,
		userSvc:  userSvc,
		UserCtrl: userCtrl,
		AuthCtrl: authCtrl,
	}
}
