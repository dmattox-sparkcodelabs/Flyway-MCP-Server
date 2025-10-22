#!/bin/bash

# Flyway MCP Server - Test Database Setup
# Copyright (c) 2025 David Mattox @ SparkCodeLabs.com
# Licensed under the MIT License. See LICENSE file in the project root.

set -e

echo "🚀 Setting up Flyway MCP Test Environment"

# Check if Docker is available
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

# Configuration
CONTAINER_NAME="flyway-mcp-test-db"
DB_NAME="flyway_test"
DB_USER="testuser"
DB_PASSWORD="testpass123"
DB_PORT="5433"

echo "📦 Starting PostgreSQL test database..."

# Stop and remove existing container if it exists
if docker ps -a --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    echo "🧹 Removing existing test database container..."
    docker rm -f $CONTAINER_NAME
fi

# Start PostgreSQL container
docker run -d \
    --name $CONTAINER_NAME \
    -e POSTGRES_USER=$DB_USER \
    -e POSTGRES_PASSWORD=$DB_PASSWORD \
    -e POSTGRES_DB=$DB_NAME \
    -p $DB_PORT:5432 \
    postgres:17

echo "⏳ Waiting for PostgreSQL to be ready..."
sleep 5

# Test connection
until docker exec $CONTAINER_NAME pg_isready -U $DB_USER > /dev/null 2>&1; do
    echo "   Waiting for database..."
    sleep 1
done

echo "✅ Test database is ready!"
echo ""
echo "📋 Connection Details:"
echo "   Host: localhost"
echo "   Port: $DB_PORT"
echo "   Database: $DB_NAME"
echo "   User: $DB_USER"
echo "   Password: $DB_PASSWORD"
echo ""
echo "🔗 Connection String:"
echo "   postgresql://$DB_USER:$DB_PASSWORD@localhost:$DB_PORT/$DB_NAME"
echo ""
echo "🧪 To test the MCP server with this database, set:"
echo "   export FLYWAY_URL=\"postgresql://$DB_USER:$DB_PASSWORD@localhost:$DB_PORT/$DB_NAME\""
echo "   export FLYWAY_LOCATIONS=\"filesystem:./test-migrations\""
echo ""
echo "🛑 To stop the test database:"
echo "   docker stop $CONTAINER_NAME"
echo ""
echo "🗑️  To remove the test database:"
echo "   docker rm -f $CONTAINER_NAME"
