package service

import (
	"net/http"

	"github.com/Et43/BARK/constant"
	"github.com/Et43/BARK/database/dao"
	"github.com/Et43/BARK/pkg"
	"github.com/Et43/BARK/repository"
	"github.com/gin-gonic/gin"
	log "github.com/sirupsen/logrus"
	"golang.org/x/crypto/bcrypt"
)

type AuthService interface {
	Login(c *gin.Context)
	Register(c *gin.Context)
}

type AuthServiceImpl struct {
	userRepository repository.UserRepository
}

type LoginRequest struct {
	Email    string `json:"email" binding:"required"`
	Password string `json:"password" binding:"required"`
}

type LoginResponse struct {
	Token string   `json:"token"`
	User  dao.User `json:"user"`
}

type RegisterRequest struct {
	Name     string `json:"name" binding:"required"`
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required,min=6"`
	Role     string `json:"role"`
}

func (a AuthServiceImpl) Login(c *gin.Context) {
	defer pkg.PanicHandler(c)

	var request LoginRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		log.Error(err)
		pkg.PanicException(constant.InvalidRequest)
	}

	// Find user by email
	user, err := a.userRepository.FindByEmail(request.Email)
	if err != nil {
		log.Error(err)
		pkg.PanicException(constant.Unauthorised)
	}

	// Check password
	log.Info("User password: ", user.Password)
	hashedPasswrd, err := bcrypt.GenerateFromPassword([]byte(request.Password), bcrypt.DefaultCost)
	log.Info("Request password: ", string(hashedPasswrd))
	err = bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(request.Password))
	if err != nil {
		log.Error("Failed login attempt for user: ", user.Email)
		c.JSON(http.StatusUnauthorized, pkg.BuildResponse[any](constant.Unauthorised, nil))
		return
	}

	// Generate JWT token
	token, err := pkg.GenerateJWT(user)
	if err != nil {
		log.Error(err)
		pkg.PanicException(constant.UnkownError)
	}

	response := LoginResponse{
		Token: token,
		User:  user,
	}

	c.JSON(http.StatusOK, pkg.BuildResponse(constant.Success, response))
}

func (a AuthServiceImpl) Register(c *gin.Context) {
	defer pkg.PanicHandler(c)

	var request RegisterRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		log.Error(err)
		pkg.PanicException(constant.InvalidRequest)
	}

	// Check if user already exists
	_, err := a.userRepository.FindByEmail(request.Email)
	if err == nil {
		log.Error("User already exists")
		pkg.PanicException(constant.InvalidRequest)
	}

	// Default role to "user" if not provided or not valid
	if request.Role != "admin" && request.Role != "user" {
		request.Role = "user"
	}

	// Hash password
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(request.Password), bcrypt.DefaultCost)
	if err != nil {
		log.Error(err)
		pkg.PanicException(constant.UnkownError)
	}

	// Create new user
	user := dao.User{
		Name:     request.Name,
		Email:    request.Email,
		Password: string(hashedPassword),
		Role:     request.Role,
	}

	// Save user
	savedUser, err := a.userRepository.Save(&user)
	if err != nil {
		log.Error(err)
		pkg.PanicException(constant.UnkownError)
	}

	// Generate token
	token, err := pkg.GenerateJWT(savedUser)
	if err != nil {
		log.Error(err)
		pkg.PanicException(constant.UnkownError)
	}

	response := LoginResponse{
		Token: token,
		User:  savedUser,
	}

	c.JSON(http.StatusCreated, pkg.BuildResponse(constant.Success, response))
}

func AuthServiceInit(userRepository repository.UserRepository) *AuthServiceImpl {
	return &AuthServiceImpl{userRepository: userRepository}
}
