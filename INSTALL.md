# Flyway MCP Server - Installation Guide

## Quick Start

### Step 1: Extract and Install

On your WSL machine:

```bash
# Navigate to where you want to install it (e.g., your home directory)
cd ~

# Extract the tarball
tar -xzf flyway-mcp.tar.gz

# Navigate to the directory
cd flyway-mcp

# Install dependencies
npm install

# Make the script executable
chmod +x index.js
```

### Step 2: Configure Claude Code

Edit your Claude Code configuration file:

```bash
nano ~/.config/Claude/claude_desktop_config.json
```

Add the Flyway MCP server to your existing configuration:

```json
{
  "mcpServers": {
    "azure-devops": {
      "command": "npx",
      "args": ["-y", "@azure-devops/mcp", "SparkCodeLabs"],
      "env": {
        "AZURE_DEVOPS_PAT": "YOUR_PAT_HERE"
      }
    },
    "postgres": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-postgres"],
      "env": {
        "POSTGRES_CONNECTION_STRING": "postgresql://forgecoreadmin:forgecorepass123@host.docker.internal:5432/forgecoredb"
      }
    },
    "flyway": {
      "command": "node",
      "args": ["/home/dmatt/flyway-mcp/index.js"],
      "env": {
        "FLYWAY_URL": "postgresql://forgecoreadmin:forgecorepass123@host.docker.internal:5432/forgecoredb",
        "FLYWAY_LOCATIONS": "filesystem:/home/dmatt/projects/SparkCodeLabs/SparkForgeWorks/migrations"
      }
    }
  }
}
```

**Important:** Update these paths:
- `/home/dmatt/flyway-mcp/index.js` - Change to wherever you extracted the server
- `/home/dmatt/projects/SparkCodeLabs/SparkForgeWorks/migrations` - Change to your actual migrations directory

### Step 3: Create Migrations Directory

If you don't already have a migrations directory in your project:

```bash
cd ~/projects/SparkCodeLabs/SparkForgeWorks
mkdir -p migrations
```

### Step 4: Restart Claude Code

Fully quit and restart Claude Code for the changes to take effect.

### Step 5: Verify Installation

After restarting, run:

```bash
claude mcp list
```

You should see:
```
flyway: node /home/dmatt/flyway-mcp/index.js - ✓ Connected
```

## Usage

Once installed, you can ask Claude Code:

- **"Show me the Flyway migration status"**
- **"Create a Flyway migration to add a products table"**
- **"Apply the pending Flyway migrations"**
- **"Validate the Flyway migrations"**

## Important Notes

### Claude Will Now Use Flyway for Schema Changes

With this MCP server installed, Claude Code will:
- ✅ Create proper Flyway migration files for schema changes
- ✅ Use versioned, tracked migrations
- ✅ Follow your migration workflow

Instead of:
- ❌ Running direct CREATE TABLE or ALTER TABLE commands
- ❌ Bypassing version control
- ❌ Making untracked schema changes

### Migration File Location

The migrations directory specified in `FLYWAY_LOCATIONS` should be:
1. Part of your project repository
2. Committed to version control (Git)
3. Accessible from where Claude Code runs

### First Time Setup

If you have an existing database with tables already created, you should baseline it first:

Ask Claude: "Baseline the Flyway schema history for the existing database"

This marks your current database state as the starting point for future migrations.

## Troubleshooting

### Server won't connect
- Check that the path in `args` is correct
- Verify `FLYWAY_URL` matches your database connection
- Ensure migrations directory exists and is accessible
- Check `claude mcp list` for error messages

### "Migration directory not found"
- Create the directory: `mkdir -p /path/to/your/migrations`
- Update `FLYWAY_LOCATIONS` in the config to match the actual path

### Permission errors
- Ensure your database user has CREATE, ALTER, DROP permissions
- Check file system permissions on the migrations directory

## Advanced Configuration

### Custom Migration Location
```json
"FLYWAY_LOCATIONS": "filesystem:/custom/path/to/migrations"
```

### Multiple Migration Locations
```json
"FLYWAY_LOCATIONS": "filesystem:./migrations,filesystem:./seeds"
```

### Baseline on Migrate (for existing databases)
```json
"FLYWAY_BASELINE_ON_MIGRATE": "true"
```

## Next Steps

1. Test by asking Claude to check migration status
2. Create a test migration
3. Apply it to verify everything works
4. Start using Flyway for all schema changes!

Your database schema changes are now properly version-controlled! 🎉
