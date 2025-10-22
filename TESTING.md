<!--
Copyright (c) 2025 David Mattox @ SparkCodeLabs.com
Licensed under the MIT License. See LICENSE file in the project root.
-->

# Testing Guide for Flyway MCP Server

This document describes how to test the Flyway MCP Server using various methods.

## Table of Contents

1. [Automated Unit Tests](#automated-unit-tests)
2. [MCP Inspector Testing](#mcp-inspector-testing)
3. [Manual Testing with Claude Desktop](#manual-testing-with-claude-desktop)
4. [Integration Testing with Test Database](#integration-testing-with-test-database)

---

## Automated Unit Tests

### Setup

The project uses Jest for automated testing.

```bash
# Install dependencies (including Jest)
npm install

# Run tests
npm test

# Run tests in watch mode (auto-rerun on changes)
npm run test:watch

# Run tests with coverage report
npm run test:coverage
```

### Test Structure

Tests are located in `index.test.js` and cover:

- **Schema Validation**: Validates Zod schemas for tool inputs
- **Migration File Creation**: Tests file naming and content
- **Timestamp Generation**: Ensures correct format and sequencing
- **Environment Configuration**: Validates config parsing

### Writing New Tests

Add tests to `index.test.js`:

```javascript
describe('New Feature', () => {
  test('should do something', () => {
    // Test code here
    expect(result).toBe(expected);
  });
});
```

---

## MCP Inspector Testing

The MCP Inspector provides interactive testing of MCP tools without needing Claude Desktop.

### Installation and Usage

```bash
# Install the MCP Inspector globally
npm install -g @modelcontextprotocol/inspector

# Run the inspector with your MCP server
npx @modelcontextprotocol/inspector node index.js
```

### Required Environment Variables

Before running the inspector, set these environment variables:

```bash
export FLYWAY_URL="postgresql://testuser:testpass123@localhost:5433/flyway_test"
export FLYWAY_LOCATIONS="filesystem:./test-migrations"
```

Or run inline:

```bash
FLYWAY_URL="postgresql://testuser:testpass123@localhost:5433/flyway_test" \
FLYWAY_LOCATIONS="filesystem:./test-migrations" \
npx @modelcontextprotocol/inspector node index.js
```

### Using the Inspector

1. The inspector will open a web interface (usually at http://localhost:5173)
2. You'll see all available tools listed
3. Click on a tool to test it
4. Enter parameters in JSON format
5. View the response

### Example Inspector Test Flow

1. **Test flyway_info**
   - Parameters: `{}`
   - Should return migration status

2. **Test create_migration**
   ```json
   {
     "description": "create_test_table",
     "sql": "CREATE TABLE test (id SERIAL PRIMARY KEY);"
   }
   ```
   - Should create migration file

3. **Test flyway_migrate**
   - Parameters: `{}`
   - Should apply pending migrations

---

## Manual Testing with Claude Desktop

### Setup Test Environment

1. **Start test database** (see [Integration Testing](#integration-testing-with-test-database))

2. **Configure Claude Desktop** with test config:

```bash
# Copy test config to Claude Desktop config location
# Edit the path to match your local setup
```

Add to `~/.config/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "flyway-test": {
      "command": "node",
      "args": ["/absolute/path/to/flyway-mcp-source/index.js"],
      "env": {
        "FLYWAY_URL": "postgresql://testuser:testpass123@localhost:5433/flyway_test",
        "FLYWAY_LOCATIONS": "filesystem:/absolute/path/to/flyway-mcp-source/test-migrations"
      }
    }
  }
}
```

3. **Restart Claude Desktop**

4. **Verify connection**:
```bash
claude mcp list
```

Should show:
```
flyway-test: node /path/to/index.js - ✓ Connected
```

### Manual Test Cases

#### Test 1: Check Status
Ask Claude: "Show me the Flyway migration status"

Expected: Should call `flyway_info` and show current state

#### Test 2: Create Migration
Ask Claude: "Create a Flyway migration to add a users table with id, username, and email columns"

Expected:
- Should call `create_migration`
- Should create file like `V20250122143000__add_users_table.sql`
- File should exist in `test-migrations/` directory

#### Test 3: Apply Migration
Ask Claude: "Apply the pending Flyway migrations"

Expected:
- Should call `flyway_migrate`
- Migration should be applied to test database
- `flyway_schema_history` table should have new entry

#### Test 4: Validate
Ask Claude: "Validate the Flyway migrations"

Expected:
- Should call `flyway_validate`
- Should report no conflicts

#### Test 5: Baseline (if needed)
Ask Claude: "Baseline the Flyway schema history"

Expected:
- Should call `flyway_baseline`
- Should create baseline entry in schema history

---

## Integration Testing with Test Database

### Prerequisites

- Docker installed and running
- PostgreSQL client tools (optional, for manual verification)

### Setup Test Database

```bash
# Make the setup script executable
chmod +x test-setup.sh

# Run the setup script
./test-setup.sh
```

This will:
- Start a PostgreSQL container named `flyway-mcp-test-db`
- Create database `flyway_test`
- Configure user `testuser` with password `testpass123`
- Expose on port `5433` (to avoid conflicts with other PostgreSQL instances)

### Connection Details

```
Host:     localhost
Port:     5433
Database: flyway_test
User:     testuser
Password: testpass123
```

Connection String:
```
postgresql://testuser:testpass123@localhost:5433/flyway_test
```

### Create Test Migrations Directory

```bash
mkdir -p test-migrations
```

### Run Integration Tests

```bash
# Set environment variables
export FLYWAY_URL="postgresql://testuser:testpass123@localhost:5433/flyway_test"
export FLYWAY_LOCATIONS="filesystem:./test-migrations"

# Start the MCP server
node index.js
```

The server will connect to the test database and be ready to accept MCP commands.

### Verify Database State

```bash
# Connect to test database
docker exec -it flyway-mcp-test-db psql -U testuser -d flyway_test

# List tables
\dt

# View schema history
SELECT * FROM flyway_schema_history ORDER BY installed_rank;

# Exit
\q
```

### Cleanup

```bash
# Stop test database
docker stop flyway-mcp-test-db

# Remove test database
docker rm -f flyway-mcp-test-db

# Clean up test migrations
rm -rf test-migrations
```

---

## Continuous Integration

### GitHub Actions Example

Create `.github/workflows/test.yml`:

```yaml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:17
        env:
          POSTGRES_USER: testuser
          POSTGRES_PASSWORD: testpass123
          POSTGRES_DB: flyway_test
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v3

      - uses: actions/setup-node@v3
        with:
          node-version: '18'

      - run: npm install

      - run: npm test
        env:
          FLYWAY_URL: postgresql://testuser:testpass123@localhost:5432/flyway_test
          FLYWAY_LOCATIONS: filesystem:./test-migrations
```

---

## Troubleshooting

### Jest Tests Fail

**Problem**: `Cannot find module` errors

**Solution**: Ensure you're using Node.js 16+ and Jest is configured for ES modules

```bash
node --version  # Should be 16+
npm test
```

### MCP Inspector Won't Connect

**Problem**: Inspector can't connect to server

**Solution**: Ensure environment variables are set:

```bash
export FLYWAY_URL="postgresql://testuser:testpass123@localhost:5433/flyway_test"
npx @modelcontextprotocol/inspector node index.js
```

### Test Database Won't Start

**Problem**: Port 5433 is already in use

**Solution**: Stop existing container or use different port:

```bash
docker stop flyway-mcp-test-db
docker rm flyway-mcp-test-db
```

Or edit `test-setup.sh` to use a different port.

### Migrations Not Applied

**Problem**: `flyway_migrate` doesn't apply migrations

**Solution**: Check:
1. Migration files exist in correct directory
2. Files follow naming convention `V{timestamp}__{description}.sql`
3. Database connection is valid
4. User has CREATE/ALTER permissions

---

## Best Practices

1. **Always test against test database** - Never test against production
2. **Clean up after tests** - Remove test migrations and reset database
3. **Use MCP Inspector for rapid iteration** - Faster than Claude Desktop restarts
4. **Write unit tests for new features** - Maintain good test coverage
5. **Verify migration files** - Check that generated files are correct before applying
6. **Test error cases** - Ensure validation and error handling work correctly

---

## Additional Resources

- [Jest Documentation](https://jestjs.io/)
- [MCP SDK Documentation](https://github.com/modelcontextprotocol/sdk)
- [Flyway Documentation](https://documentation.red-gate.com/flyway)
- [PostgreSQL Docker Image](https://hub.docker.com/_/postgres)
