package middleware

import (
	"strings"

	"github.com/Et43/BARK/constant"
	"github.com/Et43/BARK/pkg"
	"github.com/gin-gonic/gin"
)

func JWTAuth() gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.AbortWithStatusJSON(401, pkg.BuildResponse(constant.Unauthorised, pkg.Null()))
			return
		}

		// Check if the header starts with "Bearer "
		if !strings.HasPrefix(authHeader, "Bearer ") {
			c.AbortWithStatusJSON(401, pkg.BuildResponse(constant.Unauthorised, pkg.Null()))
			return
		}

		// Extract the token
		tokenString := strings.TrimPrefix(authHeader, "Bearer ")

		// Validate the token
		claims, err := pkg.ValidateToken(tokenString)
		if err != nil {
			c.AbortWithStatusJSON(401, pkg.BuildResponse(constant.Unauthorised, pkg.Null()))
			return
		}

		// Store user details in context for later use
		c.Set("userID", claims.UserID)
		c.Set("userName", claims.Name)
		c.Set("userEmail", claims.Email)
		c.Set("userRole", claims.Role)

		c.Next()
	}
}
