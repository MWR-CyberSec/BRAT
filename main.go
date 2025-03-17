package main

import (
	"os"

	"github.com/Et43/BARK/config"
	"github.com/Et43/BARK/router"
	"github.com/joho/godotenv"
)

func init() {
	godotenv.Load()
	config.InitLog()
}

func main() {
	port := os.Getenv("PORT")

	init := config.Init()
	app := router.InitRouter(init)

	app.Run(":" + port)
}
