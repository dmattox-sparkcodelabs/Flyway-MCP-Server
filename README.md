<!--
Copyright (c) 2025 David Mattox @ SparkCodeLabs.com
Licensed under the MIT License. See LICENSE file in the project root.
-->

# Flyway MCP Server

A Model Context Protocol (MCP) server that provides Flyway database migration management capabilities to AI assistants like Claude Code.

## The Problem This Solves

Without this MCP server, AI assistants make direct database schema changes through SQL commands, bypassing your migration workflow. This leads to:
- ❌ Unversioned, untracked database changes
- ❌ Inconsistencies between environments
- ❌ Difficulty reproducing changes
- ❌ No audit trail of schema modifications

## The Solution

This Flyway MCP server enforces proper migration practices by providing AI assistants with tools to create and manage versioned migration files instead of running direct SQL commands.

**Before (Direct SQL):**
```
You: "Add a users table to the database"
Claude: [Runs CREATE TABLE directly via PostgreSQL MCP]
Result: Untracked schema change ❌
```

**After (With Flyway MCP):**
```
You: "Add a users table to the database"
Claude: [Creates V20241022143000__create_users_table.sql]
You: "Apply the migration"
Claude: [Runs flyway_migrate]
Result: Versioned, tracked, repeatable migration ✅
```

## Features

- **Migration Management**: Create, apply, and track database migrations
- **Schema Validation**: Validate migrations and check for conflicts
- **Migration History**: View detailed information about applied migrations
- **Enforced Workflow**: Encourages proper migration files over direct schema changes
- **Version Control Ready**: All migrations are files that can be committed to Git

## Available Tools

1. **create_migration** - Create new migration files with proper naming convention
2. **flyway_migrate** - Apply pending migrations to the database
3. **flyway_info** - Get current migration status and history
4. **flyway_validate** - Validate applied migrations against available files
5. **flyway_baseline** - Baseline an existing database
6. **flyway_repair** - Repair migration history after failures
7. **flyway_clean** - Drop all database objects (⚠️ development only!)

## Installation

### Prerequisites

- Node.js v16 or higher
- A PostgreSQL database (or other Flyway-supported database)

### Setup

1. **Clone or download this repository**

```bash
git clone https://github.com/dmattox-sparkcodelabs/Flyway-MCP-Server.git
cd Flyway-MCP-Server
```

2. **Install dependencies**

```bash
npm install
```

3. **Make the script executable**

```bash
chmod +x index.js
```

4. **Configure Claude Code**

Add to your `~/.config/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "flyway": {
      "command": "node",
      "args": ["/absolute/path/to/Flyway-MCP-Server/index.js"],
      "env": {
        "FLYWAY_URL": "postgresql://user:password@host:5432/database",
        "FLYWAY_LOCATIONS": "filesystem:/absolute/path/to/your/project/migrations"
      }
    }
  }
}
```

**Important:** Replace with absolute paths:
- Path to `index.js` in this repository
- Path to your project's migrations directory

5. **Create migrations directory in your project**

```bash
cd /path/to/your/project
mkdir -p migrations
```

6. **Restart Claude Code**

Fully quit and restart Claude Code for changes to take effect.

7. **Verify installation**

```bash
claude mcp list
```

Should show:
```
flyway: node /path/to/index.js - ✓ Connected
```

## Configuration

The server is configured via environment variables in the Claude Code config:

### Required

- **FLYWAY_URL** or **POSTGRES_CONNECTION_STRING** - Database connection URL
  - Format: `postgresql://user:password@host:port/database`
  - Example: `postgresql://admin:pass123@localhost:5432/mydb`

### Optional

- **FLYWAY_LOCATIONS** - Migration directory (default: `filesystem:./migrations`)
  - Example: `filesystem:/home/user/project/migrations`
  - Multiple locations: `filesystem:./migrations,filesystem:./seeds`

- **FLYWAY_USER** - Database user (if not in URL)
- **FLYWAY_PASSWORD** - Database password (if not in URL)
- **FLYWAY_BASELINE_ON_MIGRATE** - Auto-baseline on first run (default: `false`)

### WSL/Windows Note

When using WSL with Windows-hosted PostgreSQL:
```json
{
  "FLYWAY_URL": "postgresql://user:pass@host.docker.internal:5432/database"
}
```

## Usage

### Check Migration Status

Ask Claude:
```
"Show me the Flyway migration status"
"What migrations are pending?"
"Have all migrations been applied?"
```

### Create a Migration

Ask Claude:
```
"Create a Flyway migration to add a users table with id, username, email, and created_at"
"Create a migration to add an index on the email column"
"Create a migration to add a foreign key from orders to users"
```

Claude will create a file like:
```
migrations/V20241022143000__create_users_table.sql
```

### Apply Migrations

Ask Claude:
```
"Apply the pending Flyway migrations"
"Run the Flyway migrations"
"Migrate the database"
```

### Validate Migrations

Ask Claude:
```
"Validate the Flyway migrations"
"Check for migration conflicts"
"Verify the migration checksums"
```

### Baseline Existing Database

If you have an existing database with tables already created:

Ask Claude:
```
"Baseline the Flyway schema history for the existing database"
"Set up Flyway baseline at version 1"
```

## Migration File Convention

Migration files follow Flyway's standard naming:

```
V{YYYYMMDDHHmmss}__{description}.sql
```

Example:
```
V20241022143000__create_users_table.sql
```

The `create_migration` tool automatically:
- Generates the timestamp
- Sanitizes the description
- Creates the file in the correct location

## Workflow

1. **Plan** - Decide what schema change is needed
2. **Create** - Ask Claude to create a Flyway migration
3. **Review** - Check the generated SQL file
4. **Apply** - Ask Claude to run the migration
5. **Verify** - Check that it applied successfully
6. **Commit** - Add the migration file to Git

## Best Practices

### ✅ DO:
- Always use `create_migration` for schema changes
- Review migration files before applying them
- Keep migrations small and focused
- Use descriptive migration names
- Commit migration files to version control
- Test migrations locally before production
- Run `flyway_validate` before deploying

### ❌ DON'T:
- Never run direct CREATE/ALTER/DROP commands
- Don't edit applied migration files
- Don't delete migration files
- Don't use `flyway_clean` in production
- Don't skip migration validation

## Common Commands

| Task | What to Ask Claude |
|------|-------------------|
| Check status | "Show me the Flyway migration status" |
| Create migration | "Create a Flyway migration to [change]" |
| Apply migrations | "Apply the pending Flyway migrations" |
| Validate | "Validate the Flyway migrations" |
| Baseline | "Baseline the Flyway schema history" |
| Repair history | "Repair the Flyway schema history" |

## Troubleshooting

### Server Won't Connect

**Problem**: Claude Code shows Flyway MCP as disconnected

**Solutions**:
- Check that the path in `args` is correct and absolute
- Verify `FLYWAY_URL` is set and valid
- Ensure Node.js v16+ is installed: `node --version`
- Check `claude mcp list` for error messages

### Migration Directory Not Found

**Problem**: Error about migrations directory

**Solutions**:
```bash
# Create the directory
mkdir -p /path/to/your/migrations

# Verify FLYWAY_LOCATIONS in config uses absolute path
```

### Database Connection Fails

**Problem**: Can't connect to database

**Solutions**:
- Verify database is running
- Check connection string format
- Test connection: `psql -h host -U user -d database`
- For WSL: Use `host.docker.internal` instead of `localhost`

### Migrations Not Applied

**Problem**: `flyway_migrate` doesn't apply migrations

**Solutions**:
1. Check migration files exist in correct directory
2. Verify files follow naming convention `V{timestamp}__{description}.sql`
3. Check database user has CREATE/ALTER permissions
4. Run `flyway_info` to see migration status
5. Check for errors in migration SQL

### Existing Database Has Tables

**Problem**: Database has tables but no Flyway history

**Solution**:
```
Ask Claude: "Baseline the Flyway schema history"
```

This marks your current database state as the starting point.

## Testing

See [TESTING.md](TESTING.md) for:
- Running automated tests
- Using MCP Inspector for interactive testing
- Testing with a real database
- Integration testing setup

## Benefits

✅ **Version Control** - All schema changes tracked in Git
✅ **Repeatability** - Same migrations work across all environments
✅ **Safety** - Prevents accidental direct schema changes
✅ **Auditability** - Complete history of all schema modifications
✅ **CI/CD Ready** - Migrations can be automated in pipelines
✅ **Team Collaboration** - Everyone uses the same migration files

## Integration with Other MCPs

This MCP works alongside your existing MCP servers:

- **Azure DevOps MCP** - For work items, PRs, builds
- **PostgreSQL MCP** - For querying data (read operations)
- **Flyway MCP** - For schema changes (write operations via migrations)

Each serves a specific purpose without overlap.

## Security Notes

- Credentials are passed via environment variables (never hardcoded)
- The `flyway_clean` command is dangerous - only use in development
- No authentication/authorization - relies on MCP client security
- Database permissions should be restricted per environment
- Migration files are written with process user permissions

## Architecture

- **Single-file MCP server** - `index.js` with `server.js` module
- **Protocol**: Model Context Protocol via stdio transport
- **Runtime**: Node.js (v16+)
- **Migration Tool**: Flyway via `node-flyway` wrapper
- **Validation**: Zod schemas for type-safe arguments

## License

MIT License - Copyright (c) 2025 David Mattox @ SparkCodeLabs.com

See [LICENSE](LICENSE) file for details.

## Contributing

Issues and pull requests welcome at:
https://github.com/dmattox-sparkcodelabs/Flyway-MCP-Server

## Additional Documentation

- [TESTING.md](TESTING.md) - Comprehensive testing guide
- [CLAUDE.md](CLAUDE.md) - Instructions for Claude Code when working with this codebase
