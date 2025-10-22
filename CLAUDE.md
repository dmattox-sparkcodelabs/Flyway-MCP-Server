<!--
Copyright (c) 2025 David Mattox @ SparkCodeLabs.com
Licensed under the MIT License. See LICENSE file in the project root.
-->

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Model Context Protocol (MCP) server that provides Flyway database migration management to AI assistants. It wraps the Flyway CLI via the `node-flyway` package and exposes migration operations as MCP tools.

**Key Purpose**: Enable AI assistants to create and manage database migrations following proper version control practices, preventing direct schema changes and enforcing migration-based workflows.

## Architecture

### Technology Stack
- **Runtime**: Node.js (v16+)
- **MCP SDK**: `@modelcontextprotocol/sdk` v1.20.1
- **Flyway Integration**: `node-flyway` v0.0.13 (downloads and manages Flyway CLI)
- **Validation**: Zod v3.25.76 for schema validation
- **Transport**: stdio (standard input/output communication with MCP clients)

### Core Components

**index.js** (299 lines) - Single-file MCP server implementation
- Server initialization and configuration (lines 36-64)
- Tool registration with 7 Flyway operations (lines 67-147)
- Tool execution handler with Zod validation (lines 150-286)
- Main entry point and stdio transport setup (lines 289-298)

### Configuration System

Environment variables control all configuration:
- `FLYWAY_URL` or `POSTGRES_CONNECTION_STRING` (required) - Database connection
- `FLYWAY_USER`, `FLYWAY_PASSWORD` (optional) - Credentials if not in URL
- `FLYWAY_LOCATIONS` (optional, default: `filesystem:./migrations`) - Migration directory
- `FLYWAY_BASELINE_ON_MIGRATE` (optional, default: `false`) - Auto-baseline behavior

Configuration is validated at startup (lines 44-48) and fails fast if database URL is missing.

## Available Tools

1. **flyway_info** - Returns migration status from schema history table
2. **flyway_migrate** - Executes pending migrations
3. **flyway_validate** - Validates migration checksums and order
4. **flyway_clean** - Drops all database objects (DANGEROUS - dev only)
5. **flyway_baseline** - Sets initial version for existing databases
6. **flyway_repair** - Repairs schema history table after failures
7. **create_migration** - Creates timestamped migration files (V{timestamp}__{description}.sql)

## Development Workflow

### Running the Server

```bash
# Local development
npm install
chmod +x index.js
node index.js

# Testing via Claude Code
# Add to ~/.config/Claude/claude_desktop_config.json
```

### Testing
Currently no automated tests exist. Manual testing requires:
1. Configuring with a test database
2. Running via Claude Code MCP client
3. Verifying tool responses

### Migration File Convention

Format: `V{YYYYMMDDHHmmss}__{description}.sql`

Example: `V20241022143000__create_users_table.sql`

The `create_migration` tool (lines 233-275):
- Generates timestamp from current date/time
- Sanitizes description (lowercase, underscores only)
- Creates migration directory if needed
- Writes SQL content to properly named file
- Returns next steps to user

## Key Design Decisions

1. **Single File Architecture**: Entire server in index.js for simplicity and distribution
2. **Stdio Transport**: Uses stdio for MCP communication (standard for desktop integrations)
3. **Zero Tool Arguments**: Most tools take no parameters for simplicity
4. **Explicit Migration Creation**: Separates file creation from application to enforce review
5. **Environment-Based Config**: No config files, all via environment variables
6. **Migration Directory Auto-Creation**: Creates directory if missing (line 246)

## Installation and Distribution

The project is distributed as a tarball (`flyway-mcp.tar.gz`) containing:
- Source code (index.js, package.json)
- Documentation (README.md, INSTALL.md, QUICKREF.md, START_HERE.md, SUMMARY.md, CONFIG_TEMPLATE.md)

Users extract to their local filesystem and reference the absolute path in Claude Code configuration.

## Common Operations

### Adding New Tools

1. Create Zod schema for validation (lines 14-33)
2. Add tool definition to ListToolsRequestSchema handler (lines 67-147)
3. Add case to CallToolRequestSchema handler (lines 150-286)
4. Parse arguments with Zod schema
5. Call Flyway API and return formatted result

### Modifying Tool Behavior

All tool implementations follow this pattern:
```javascript
case 'tool_name': {
  ValidatedSchema.parse(args);
  const result = await flyway.operation();
  return {
    content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
  };
}
```

### Debugging

- Server logs to stderr (line 292)
- MCP client captures stderr for debugging
- Zod validation errors are caught and reformatted (lines 281-283)
- Check `claude mcp list` for connection status

## Integration Notes

### Database Compatibility
- Primarily tested with PostgreSQL
- Connection string format: `postgresql://user:pass@host:port/database`
- Uses host.docker.internal for WSL->Windows database connections

### Migration Directory Location
- Should be inside project repository for version control
- Can be absolute or relative path
- Prefix with `filesystem:` for Flyway locations
- Multiple locations supported (comma-separated)

### Claude Code Integration
The MCP client (Claude Code) will:
- Suggest using migrations instead of direct schema changes
- Create migration files via `create_migration` tool
- Apply migrations with user confirmation
- Validate before production deployments

## Security Considerations

- Credentials passed via environment variables (never hardcoded)
- `flyway_clean` is dangerous - documentation emphasizes dev-only use
- No authentication/authorization - relies on MCP client security
- Database permissions should be restricted per environment
- Migration files are written to filesystem with process user permissions
