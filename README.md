<!--
Copyright (c) 2025 David Mattox @ SparkCodeLabs.com
Licensed under the MIT License. See LICENSE file in the project root.
-->

# Flyway MCP Server

A Model Context Protocol (MCP) server that provides Flyway database migration management capabilities to AI assistants like Claude Code.

## Features

- **Migration Management**: Create, apply, and track database migrations
- **Schema Validation**: Validate migrations and check for conflicts
- **Migration History**: View detailed information about applied migrations
- **Enforced Workflow**: Prevents direct database schema changes, requiring proper migration files

## Tools Provided

1. **flyway_info** - Get current migration status
2. **flyway_migrate** - Apply pending migrations
3. **flyway_validate** - Validate applied migrations
4. **flyway_clean** - Drop all database objects (development only!)
5. **flyway_baseline** - Baseline an existing database
6. **flyway_repair** - Repair migration history
7. **create_migration** - Create new migration files with proper naming

## Installation

### Local Development

1. Clone or copy this directory to your machine
2. Install dependencies:
   ```bash
   npm install
   ```

3. Make the script executable:
   ```bash
   chmod +x index.js
   ```

### Global Installation (Optional)

```bash
npm install -g .
```

## Configuration

The server requires database connection information via environment variables:

### Required
- `FLYWAY_URL` or `POSTGRES_CONNECTION_STRING` - Database connection URL
  - Example: `postgresql://user:password@host:5432/database`

### Optional
- `FLYWAY_USER` - Database user (if not in URL)
- `FLYWAY_PASSWORD` - Database password (if not in URL)
- `FLYWAY_LOCATIONS` - Comma-separated migration locations (default: `filesystem:./migrations`)
- `FLYWAY_BASELINE_ON_MIGRATE` - Baseline on first migration (default: `false`)

## Claude Code Setup

Add to your `~/.config/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "flyway": {
      "command": "node",
      "args": ["/path/to/flyway-mcp/index.js"],
      "env": {
        "FLYWAY_URL": "postgresql://forgecoreadmin:forgecorepass123@host.docker.internal:5432/forgecoredb",
        "FLYWAY_LOCATIONS": "filesystem:/path/to/your/migrations"
      }
    }
  }
}
```

Or use with npx if published:

```json
{
  "mcpServers": {
    "flyway": {
      "command": "npx",
      "args": ["-y", "flyway-mcp"],
      "env": {
        "FLYWAY_URL": "postgresql://user:pass@host:5432/db",
        "FLYWAY_LOCATIONS": "filesystem:./migrations"
      }
    }
  }
}
```

## Usage Examples

### Check Migration Status
Ask Claude: "Show me the current Flyway migration status"

### Create a New Migration
Ask Claude: "Create a Flyway migration to add a users table with id, name, and email columns"

### Apply Migrations
Ask Claude: "Run the pending Flyway migrations"

### Validate Migrations
Ask Claude: "Validate the Flyway migrations"

## Migration File Naming Convention

Migration files follow Flyway's standard naming convention:

```
V{timestamp}__{description}.sql
```

Example:
```
V20241022143000__create_users_table.sql
```

The timestamp format is: `YYYYMMDDHHmmss`

## Best Practices

1. **Always use create_migration** - Never make direct schema changes
2. **Review before applying** - Check generated migration files before running migrate
3. **Version control** - Commit migration files to your repository
4. **Test locally first** - Apply migrations in development before production
5. **Use descriptive names** - Make migration descriptions clear and meaningful

## Security Notes

- This server uses the `node-flyway` package which downloads and manages Flyway CLI
- Credentials are passed via environment variables (never hardcoded)
- The `clean` command is dangerous - only use in development
- Consider restricting write permissions in production environments

## Troubleshooting

### Server won't start
- Check that `FLYWAY_URL` or `POSTGRES_CONNECTION_STRING` is set
- Verify database connection string is valid
- Check that Node.js version is compatible (v16+)

### Migrations fail
- Run `flyway_validate` to check for conflicts
- Check migration file syntax
- Verify database connectivity
- Check Flyway schema history table

### Permission errors
- Ensure database user has CREATE/ALTER/DROP permissions
- Check file system permissions for migration directory

## License

ISC
