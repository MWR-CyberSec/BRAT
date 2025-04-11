package config

import (
	"github.com/Et43/BARK/controller"
	"github.com/Et43/BARK/repository"
	"github.com/Et43/BARK/service"
)

type Initialization struct {
	UserRepo      repository.UserRepository
	UserSvc       service.UserService
	UserCtrl      controller.UserController
	AuthCtrl      controller.AuthController // Change from AuthController
	AgentCtrl     controller.AgentController
	DashboardSvc  service.DashboardService
	DashboardCtrl controller.DashboardController // Change from DashboardController
}

func NewInitialization(
	userRepo repository.UserRepository,
	userService service.UserService,
	userController controller.UserController,
	authController controller.AuthController,
	agentCtrl controller.AgentController,
	dashboardService service.DashboardService, // Add this if missing
	dashboardController controller.DashboardController,
) *Initialization {
	return &Initialization{
		UserRepo:      userRepo,
		UserSvc:       userService,
		UserCtrl:      userController,
		AuthCtrl:      authController,
		AgentCtrl:     agentCtrl,
		DashboardSvc:  dashboardService, // Add this if missing
		DashboardCtrl: dashboardController,
	}
}
