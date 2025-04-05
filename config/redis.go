package config

import (
	"context"
	"log"
	"os"
	"time"

	"github.com/redis/go-redis/v9"
)

// Global Redis client
var RedisClient *redis.Client

// InitRedis initializes the Redis connection
func InitRedis() *redis.Client {
	// Get Redis URL from environment variable or use default
	redisURL := os.Getenv("REDIS_URL")
	if redisURL == "" {
		redisURL = "redis://localhost:6379"
	}

	opts, err := redis.ParseURL(redisURL)
	if err != nil {
		log.Fatalf("[BARK] Failed to parse Redis URL: %v", err)
	}

	// Set some reasonable defaults
	opts.DialTimeout = 5 * time.Second
	opts.ReadTimeout = 3 * time.Second
	opts.WriteTimeout = 3 * time.Second
	opts.PoolSize = 10

	// Create Redis client
	RedisClient = redis.NewClient(opts)

	// Test the connection
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	pong, err := RedisClient.Ping(ctx).Result()
	if err != nil {
		log.Printf("[BARK] Redis connection failed: %v", err)
	} else {
		log.Printf("[BARK] Redis connection successful: %s", pong)
	}

	return RedisClient
}

// GetRedisClient returns the global Redis client
func GetRedisClient() *redis.Client {
	if RedisClient == nil {
		log.Println("[BARK] Redis client not initialized, initializing now")
		return InitRedis()
	}
	return RedisClient
}
