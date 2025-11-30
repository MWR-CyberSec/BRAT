FROM golang:1.24-alpine AS builder

WORKDIR /app

# Copy go mod and sum files
COPY go.mod go.sum ./

# Download dependencies
RUN go mod download

# Copy the source code
COPY . .

# Build the application
RUN CGO_ENABLED=0 GOOS=linux go build -o app ./main.go

# Use a minimal alpine image for the final stage
FROM alpine:latest

WORKDIR /root/

# Install ca-certificates for HTTPS
RUN apk --no-cache add ca-certificates

# Create all required directories with explicit permissions
RUN mkdir -p templates/components templates/modals static/css static/js config/casbin templates/core plugins
RUN chmod -R 755 templates static config plugins

# Copy the binary from the builder stage
COPY --from=builder /app/app .

# Copy .env file if it exists
COPY --from=builder /app/.env ./ 

# Copy database init script
COPY --from=builder /app/build_scripts/init.sql ./

# Explicitly copy templates with full paths
COPY --from=builder /app/templates/core/base.tmpl ./templates/core/
COPY --from=builder /app/templates/core/auth.tmpl ./templates/core/
COPY --from=builder /app/templates/core/dashboard.tmpl ./templates/core/
COPY --from=builder /app/templates/core/debug_dashboard.tmpl ./templates/core/
COPY --from=builder /app/templates/components/profile_card.tmpl ./templates/components/
COPY --from=builder /app/templates/components/stats_card.tmpl ./templates/components/
COPY --from=builder /app/templates/components/actions_card.tmpl ./templates/components/
COPY --from=builder /app/templates/modals/profile_modal.tmpl ./templates/modals/
COPY --from=builder /app/templates/modals/agents_modal.tmpl ./templates/modals/
COPY --from=builder /app/templates/modals/payload_modal.tmpl ./templates/modals/
COPY --from=builder /app/templates/modals/remote_view_modal.tmpl ./templates/modals/

# Copy static assets
COPY --from=builder /app/static/css/neon.css ./static/css/
COPY --from=builder /app/static/css/dashboard.css ./static/css/
COPY --from=builder /app/static/js/main.js ./static/js/
COPY --from=builder /app/static/js/agents.js ./static/js/
COPY --from=builder /app/static/js/stager.js ./static/js/
COPY --from=builder /app/static/js/plugin-library.js ./static/js/
COPY --from=builder /app/static/js/agent_staging.js ./static/js/
COPY --from=builder /app/static/js/dashboard.js ./static/js/

# Copy Casbin configuration
COPY --from=builder /app/config/casbin/RESTful_model.conf ./config/casbin/
COPY --from=builder /app/config/casbin/policy.csv ./config/casbin/

# Copy plugins
COPY --from=builder /app/plugins/ ./plugins/

# Debug - Print directory contents
RUN ls -la ./templates
RUN ls -la ./templates/components
RUN ls -la ./templates/modals

# Expose the port
EXPOSE 8080

# Run the binary
CMD ["./app"]