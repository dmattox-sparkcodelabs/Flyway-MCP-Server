<!--
Copyright (c) 2025 David Mattox @ SparkCodeLabs.com
Licensed under the MIT License. See LICENSE file in the project root.
-->

# Flyway MCP Server - Getting Started

## 🎉 Your Custom Flyway MCP Server is Ready!

This package contains everything you need to integrate Flyway database migration management into Claude Code.

## 📦 What's Included

- **index.js** - The MCP server (ready to run)
- **package.json** - Dependencies and configuration
- **README.md** - Full documentation
- **INSTALL.md** - Step-by-step installation guide
- **QUICKREF.md** - Quick reference for daily use
- **SUMMARY.md** - Project overview and benefits
- **CONFIG_TEMPLATE.md** - Configuration template

## 🚀 Quick Start (5 Minutes)

### 1. Extract and Install
```bash
cd ~
tar -xzf flyway-mcp.tar.gz
cd flyway-mcp
npm install
chmod +x index.js
```

### 2. Create Migrations Directory
```bash
cd ~/projects/SparkCodeLabs/SparkForgeWorks
mkdir -p migrations
```

### 3. Configure Claude Code
```bash
nano ~/.config/Claude/claude_desktop_config.json
```

Add this (customize the paths):
```json
"flyway": {
  "command": "node",
  "args": ["/home/dmatt/flyway-mcp/index.js"],
  "env": {
    "FLYWAY_URL": "postgresql://forgecoreadmin:forgecorepass123@host.docker.internal:5432/forgecoredb",
    "FLYWAY_LOCATIONS": "filesystem:/home/dmatt/projects/SparkCodeLabs/SparkForgeWorks/migrations"
  }
}
```

### 4. Restart Claude Code

### 5. Test
Ask Claude: "Show me the Flyway migration status"

## 📖 Documentation Guide

| Document | Purpose | When to Read |
|----------|---------|--------------|
| **This File** | Quick overview | Start here |
| **INSTALL.md** | Detailed setup | During installation |
| **CONFIG_TEMPLATE.md** | Configuration help | Setting up config |
| **QUICKREF.md** | Daily reference | While using |
| **README.md** | Complete docs | For details |
| **SUMMARY.md** | Project overview | Understanding benefits |

## ✨ What Problem Does This Solve?

**Before:** Claude made direct database schema changes, bypassing your migration workflow.

**After:** Claude creates proper Flyway migration files for all schema changes.

## 🛠️ How It Works

When you ask Claude to modify the database schema, it will now:

1. Create a properly named migration file (`V{timestamp}__{description}.sql`)
2. Put it in your migrations directory
3. Apply it using `flyway_migrate`
4. Track it in version control

## 💡 Example Usage

```
You: "Add a products table with id, name, price, and created_at"

Claude: "I'll create a Flyway migration for that."
[Creates V20241022143000__create_products_table.sql]

You: "Apply it"

Claude: "Running the migration now."
[Executes flyway_migrate]
✓ Migration applied successfully!
```

## ⚡ Key Commands

Ask Claude:
- "Show Flyway migration status"
- "Create a migration to [schema change]"
- "Apply pending migrations"
- "Validate migrations"

## 🔧 Customization

### Different Database?
Update `FLYWAY_URL` in the config

### Different Migration Location?
Update `FLYWAY_LOCATIONS` in the config

### Existing Database?
Ask Claude to baseline it first

## ✅ Verification Checklist

After installation, verify:
- [ ] `claude mcp list` shows flyway as "✓ Connected"
- [ ] Migrations directory exists
- [ ] You can ask Claude "Show Flyway status" and get a response
- [ ] Claude offers to create migrations instead of direct SQL

## 🆘 Troubleshooting

**Server won't connect?**
→ Check the path in config matches where you extracted it

**Migrations directory errors?**
→ Create it: `mkdir -p /path/to/migrations`

**Database connection fails?**
→ Verify `FLYWAY_URL` is correct

**More help?**
→ See INSTALL.md troubleshooting section

## 🎓 Learning Path

1. **Day 1**: Install and verify (this file + INSTALL.md)
2. **Day 2**: Create your first migration (QUICKREF.md)
3. **Week 1**: Establish workflow (use daily with QUICKREF.md)
4. **Ongoing**: Reference README.md for advanced features

## 🎯 Benefits You'll Get

✅ Version-controlled schema changes
✅ Repeatable migrations across environments  
✅ Complete change history
✅ No accidental direct SQL changes
✅ CI/CD ready migrations
✅ Team collaboration friendly

## 📞 What's Next?

1. **Install it** - Follow the Quick Start above
2. **Baseline existing database** - If you have existing tables
3. **Create first migration** - Test with a simple change
4. **Establish workflow** - Use it for all schema changes
5. **Share with team** - Everyone uses the same process

## 💪 You're Ready!

This Flyway MCP server will transform how you manage database schema changes with Claude Code. No more bypassing migrations - everything is tracked, versioned, and repeatable.

**Ready to install? Open INSTALL.md for detailed steps!**

---

Built with ❤️ for proper database migration management
