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
	is_debug := os.Getenv("DEBUG")
	host := ""
	if is_debug == "true" {
		host = "0.0.0.0" // temp
		println("[! BRAT !] Running in debug mode")
	} else {
		host = "0.0.0.0"
	}

	// Initialize Redis
	config.InitRedis()

	// MAIN APP

	init := config.Init()
	app := router.InitRouter(init)

	app.Run(host + ":" + port)
}
