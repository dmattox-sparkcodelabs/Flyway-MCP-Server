<!--
Copyright (c) 2025 David Mattox @ SparkCodeLabs.com
Licensed under the MIT License. See LICENSE file in the project root.
-->

# Flyway MCP - Quick Reference

## Available Tools

| Tool | Purpose | When to Use |
|------|---------|-------------|
| `flyway_info` | View migration status | Check what's applied, what's pending |
| `flyway_migrate` | Apply pending migrations | After creating new migration files |
| `flyway_validate` | Check for conflicts | Before deploying to production |
| `flyway_clean` | Drop all objects | **DANGER**: Development only! |
| `flyway_baseline` | Set starting point | First time with existing database |
| `flyway_repair` | Fix history table | After failed migrations |
| `create_migration` | Create new migration | **Always** for schema changes |

## Common Commands to Ask Claude

### Check Status
```
"Show me the current Flyway migration status"
"What migrations are pending?"
"Have all migrations been applied?"
```

### Create Migrations
```
"Create a Flyway migration to add a users table with id, username, email, and created_at"
"Create a migration to add an index on the email column in the users table"
"Create a migration to add a foreign key from orders to users"
```

### Apply Migrations
```
"Apply the pending Flyway migrations"
"Run the Flyway migrations"
"Migrate the database"
```

### Validate
```
"Validate the Flyway migrations"
"Check for migration conflicts"
"Verify the migration checksums"
```

### Baseline (First Time)
```
"Baseline the Flyway schema history for the existing database"
"Set up Flyway baseline at version 1"
```

## Migration File Format

Filename: `V{timestamp}__{description}.sql`

Example: `V20241022143000__create_users_table.sql`

Content:
```sql
-- Add your schema changes here
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(255) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_email ON users(email);
```

## Workflow

1. **Plan**: Decide what schema change is needed
2. **Create**: Ask Claude to create a Flyway migration
3. **Review**: Check the generated SQL file
4. **Apply**: Ask Claude to run the migration
5. **Verify**: Check that it applied successfully
6. **Commit**: Add the migration file to Git

## Best Practices

✅ **DO:**
- Always use `create_migration` for schema changes
- Review migration files before applying
- Keep migrations small and focused
- Use descriptive migration names
- Commit migration files to version control
- Test migrations locally first
- Run `flyway_validate` before deploying

❌ **DON'T:**
- Never run direct CREATE/ALTER/DROP commands
- Don't edit applied migration files
- Don't delete migration files
- Don't use `flyway_clean` in production
- Don't skip migration validation

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `FLYWAY_URL` | Yes | - | Database connection URL |
| `FLYWAY_LOCATIONS` | No | `filesystem:./migrations` | Migration directory |
| `FLYWAY_USER` | No | - | DB user (if not in URL) |
| `FLYWAY_PASSWORD` | No | - | DB password (if not in URL) |
| `FLYWAY_BASELINE_ON_MIGRATE` | No | `false` | Auto-baseline on first run |

## Troubleshooting Quick Fixes

**Problem**: "Migration directory not found"
**Fix**: `mkdir -p /path/to/migrations`

**Problem**: Migration fails with validation error
**Fix**: Ask Claude to run `flyway_repair`

**Problem**: Existing database has tables but no migration history
**Fix**: Ask Claude to baseline the database first

**Problem**: Claude tries to run direct SQL instead of creating migration
**Fix**: Remind Claude: "Create a Flyway migration for this change"

## Example Session

```
You: I need to add a products table to the database

Claude: I'll create a Flyway migration for that.
[Creates V20241022143000__create_products_table.sql]

You: Apply the migration

Claude: I'll apply the pending migration now.
[Runs flyway_migrate]
Migration V20241022143000 applied successfully!

You: Show me the status

Claude: Here's the current migration status:
[Shows flyway_info output]
✓ All migrations applied
✓ No pending migrations
```

## Key Benefits

- 🔒 **Version Control**: All schema changes tracked in Git
- 🔄 **Repeatable**: Same migrations work across all environments
- 🛡️ **Safe**: No accidental direct schema changes
- 📝 **Documented**: Migration files serve as documentation
- 🔍 **Auditable**: Complete history of all schema changes
- 🚀 **Automated**: CI/CD friendly deployment process
