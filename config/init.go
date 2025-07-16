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
	AuthCtrl      controller.AuthController
	AgentCtrl     controller.AgentController
	DashboardSvc  service.DashboardService
	DashboardCtrl controller.DashboardController
	CommandSvc    service.CommandService
	CommandCtrl   controller.CommandController
	StagerCtrl    controller.StagerController
	DebugCtrl     controller.DebugController
}

func NewInitialization(
	userRepo repository.UserRepository,
	userService service.UserService,
	userController controller.UserController,
	authController controller.AuthController,
	agentController controller.AgentController,
	dashboardService service.DashboardService,
	dashboardController controller.DashboardController,
	commandService service.CommandService,
	commandController controller.CommandController,
	stagerController controller.StagerController,
	debugController controller.DebugController,
) *Initialization {
	return &Initialization{
		UserRepo:      userRepo,
		UserSvc:       userService,
		UserCtrl:      userController,
		AuthCtrl:      authController,
		AgentCtrl:     agentController,
		DashboardSvc:  dashboardService,
		DashboardCtrl: dashboardController,
		CommandSvc:    commandService,
		CommandCtrl:   commandController,
		StagerCtrl:    stagerController,
		DebugCtrl:     debugController,
	}
}
