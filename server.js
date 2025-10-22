/**
 * Flyway MCP Server - Core Logic
 * Copyright (c) 2025 David Mattox @ SparkCodeLabs.com
 * Licensed under the MIT License. See LICENSE file in the project root.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import fs from 'fs/promises';
import path from 'path';
import { Flyway } from 'node-flyway';

// Validation schemas
export const FlywayInfoSchema = z.object({});
export const FlywayMigrateSchema = z.object({});
export const FlywayValidateSchema = z.object({});
export const FlywayCleanSchema = z.object({});
export const FlywayBaselineSchema = z.object({
  baselineVersion: z.string().optional(),
  baselineDescription: z.string().optional(),
});
export const FlywayRepairSchema = z.object({});
export const CreateMigrationSchema = z.object({
  description: z.string().describe('Description of the migration (e.g., "create_users_table")'),
  sql: z.string().describe('SQL content for the migration'),
  category: z.string().optional().describe('Migration category for structured mode (e.g., "schema", "data", "seed")'),
});

export const InitializeProjectSchema = z.object({
  project_path: z.string().describe('Absolute path to the project directory'),
  database_url: z.string().describe('Database connection URL (e.g., postgresql://user:password@host:5432/database)'),
  migrations_path: z.string().optional().describe('Relative path to migrations directory for simple mode (default: ./migrations)'),
  migration_categories: z.record(z.string()).optional().describe('Migration categories for structured mode (e.g., {schema: "./migrations/schema", data: "./migrations/data", seed: "./migrations/seed"})'),
}).refine(
  (data) => {
    // Ensure only one mode is specified
    const hasSimple = !!data.migrations_path;
    const hasStructured = !!data.migration_categories;
    return !(hasSimple && hasStructured);
  },
  {
    message: 'Cannot specify both migrations_path (simple mode) and migration_categories (structured mode). Choose one.',
  }
);

export const UpdateMigrationPathSchema = z.object({
  new_migrations_path: z.string().describe('New relative path to migrations directory (e.g., ./db/migrations)'),
});

// Module-level state for active project
let activeProjectPath = null;
let activeProjectConfig = null;
let activeFlyway = null;

/**
 * Reset project state (for testing)
 */
export function resetProjectState() {
  activeProjectPath = null;
  activeProjectConfig = null;
  activeFlyway = null;
}

/**
 * Set active Flyway instance (for testing)
 */
export function setActiveFlyway(flyway) {
  activeFlyway = flyway;
}

/**
 * Read project configuration from .flyway-mcp.json
 */
async function readProjectConfig(projectPath) {
  const configPath = path.join(projectPath, '.flyway-mcp.json');
  try {
    const content = await fs.readFile(configPath, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    return null; // Config doesn't exist yet
  }
}

/**
 * Write project configuration to .flyway-mcp.json
 */
async function writeProjectConfig(projectPath, config) {
  const configPath = path.join(projectPath, '.flyway-mcp.json');
  await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf8');
}

/**
 * Get migrations directory for active project or fall back to global config
 * @param {Object} globalConfig - Global Flyway configuration
 * @param {string} category - Migration category (for structured mode)
 * @returns {string} Absolute path to migrations directory
 */
function getMigrationsDirectory(globalConfig, category = null) {
  if (activeProjectConfig) {
    // Structured mode: use category-specific path
    if (activeProjectConfig.migration_categories) {
      if (!category) {
        throw new Error(
          'Category is required in structured mode. ' +
          `Available categories: ${Object.keys(activeProjectConfig.migration_categories).join(', ')}`
        );
      }

      const categoryPath = activeProjectConfig.migration_categories[category];
      if (!categoryPath) {
        throw new Error(
          `Invalid category "${category}". ` +
          `Available categories: ${Object.keys(activeProjectConfig.migration_categories).join(', ')}`
        );
      }

      return path.isAbsolute(categoryPath)
        ? categoryPath
        : path.join(activeProjectPath, categoryPath);
    }

    // Simple mode: use single migrations path
    if (activeProjectConfig.migrations_path) {
      const migrationsPath = activeProjectConfig.migrations_path;
      return path.isAbsolute(migrationsPath)
        ? migrationsPath
        : path.join(activeProjectPath, migrationsPath);
    }
  }

  // Fall back to global config
  if (globalConfig.locations && globalConfig.locations.length > 0) {
    const location = globalConfig.locations[0];
    if (location.startsWith('filesystem:')) {
      return location.replace('filesystem:', '');
    }
  }

  return './migrations';
}

/**
 * Check if a project has been initialized
 * Throws a helpful error if not initialized
 */
function requireInitializedProject() {
  if (!activeProjectPath || !activeProjectConfig) {
    throw new Error(
      'No project has been initialized. Please run initialize_project first.\n\n' +
      'Example: "Initialize Flyway for the project at /path/to/your/project"\n\n' +
      'This will create a .flyway-mcp.json config file and migrations directory in your project.'
    );
  }
}

/**
 * Create and configure the MCP server
 * @param {Object} flyway - Flyway instance
 * @param {Object} config - Configuration object
 * @returns {Server} Configured MCP server
 */
export function createServer(flyway, config) {
  const server = new Server(
    {
      name: 'flyway-mcp',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // List available tools
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: 'initialize_project',
          description: 'Initialize Flyway for a project. Supports simple mode (single migrations folder) or structured mode (organized by category). Creates migrations directory if needed and generates .flyway-mcp.json config file with project-specific database connection. Sets this project as active for all subsequent migration operations.',
          inputSchema: {
            type: 'object',
            properties: {
              project_path: {
                type: 'string',
                description: 'Absolute path to the project directory (e.g., /home/user/my-project)',
              },
              database_url: {
                type: 'string',
                description: 'Database connection URL (REQUIRED). Format: postgresql://user:password@host:port/database. Example: postgresql://postgres:pass@host.docker.internal:5432/mydb',
              },
              migrations_path: {
                type: 'string',
                description: 'Simple mode: Relative path to single migrations directory (optional, defaults to ./migrations). Cannot be used with migration_categories.',
              },
              migration_categories: {
                type: 'object',
                description: 'Structured mode: Object mapping category names to relative paths (e.g., {"schema": "./migrations/schema", "data": "./migrations/data", "seed": "./migrations/seed"}). Cannot be used with migrations_path.',
                additionalProperties: {
                  type: 'string',
                },
              },
            },
            required: ['project_path', 'database_url'],
          },
        },
        {
          name: 'update_migration_path',
          description: 'Update the migrations directory path in project config. NOTE: This only updates the config file - it does NOT move any existing migration files. You must manually move files if needed.',
          inputSchema: {
            type: 'object',
            properties: {
              new_migrations_path: {
                type: 'string',
                description: 'New relative path to migrations directory (e.g., ./db/migrations, ./sql/migrations)',
              },
            },
            required: ['new_migrations_path'],
          },
        },
        {
          name: 'flyway_info',
          description: 'Get information about the current state of the database schema, including applied migrations and pending migrations',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
        {
          name: 'flyway_migrate',
          description: 'Apply all pending migrations to the database. This will execute migration files that have not yet been applied.',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
        {
          name: 'flyway_validate',
          description: 'Validate the applied migrations against the available migration files. Checks for conflicts, missing migrations, or checksum mismatches.',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
        {
          name: 'flyway_clean',
          description: 'WARNING: Drops all objects in the configured schemas. This will delete all tables, views, procedures, etc. USE WITH EXTREME CAUTION - typically only for development.',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
        {
          name: 'flyway_baseline',
          description: 'Baseline an existing database, marking the current state as the starting point for migrations. Useful for existing databases.',
          inputSchema: {
            type: 'object',
            properties: {
              baselineVersion: {
                type: 'string',
                description: 'Version to use for baseline (default: 1)',
              },
              baselineDescription: {
                type: 'string',
                description: 'Description for the baseline',
              },
            },
          },
        },
        {
          name: 'flyway_repair',
          description: 'Repair the Flyway schema history table. Removes failed migration entries and realigns checksums.',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
        {
          name: 'create_migration',
          description: 'Create a new Flyway migration file with the proper naming convention and content. This is the ONLY way to create schema changes. In structured mode, category is required.',
          inputSchema: {
            type: 'object',
            properties: {
              description: {
                type: 'string',
                description: 'Description of the migration (e.g., "create_users_table")',
              },
              sql: {
                type: 'string',
                description: 'SQL content for the migration',
              },
              category: {
                type: 'string',
                description: 'Migration category (required in structured mode, ignored in simple mode). Examples: "schema", "data", "seed"',
              },
            },
            required: ['description', 'sql'],
          },
        },
      ],
    };
  });

  // Handle tool calls
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      switch (name) {
        case 'initialize_project': {
          const validatedArgs = InitializeProjectSchema.parse(args);
          const projectPath = validatedArgs.project_path;

          // Verify project directory exists
          try {
            await fs.access(projectPath);
          } catch (error) {
            throw new Error(`Project directory does not exist: ${projectPath}`);
          }

          // Check for existing config file
          const existingConfig = await readProjectConfig(projectPath);
          let configExisted = false;
          let projectConfig;
          let isStructuredMode = false;
          const createdDirs = [];

          if (existingConfig) {
            // Use existing config
            projectConfig = existingConfig;
            configExisted = true;
            isStructuredMode = !!projectConfig.migration_categories;
          } else {
            // Determine mode: structured or simple
            if (validatedArgs.migration_categories) {
              // Structured mode
              isStructuredMode = true;
              projectConfig = {
                database_url: validatedArgs.database_url,
                migration_categories: validatedArgs.migration_categories,
                created_at: new Date().toISOString(),
              };
            } else {
              // Simple mode
              const migrationsPathConfig = validatedArgs.migrations_path || './migrations';
              projectConfig = {
                database_url: validatedArgs.database_url,
                migrations_path: migrationsPathConfig,
                created_at: new Date().toISOString(),
              };
            }
            await writeProjectConfig(projectPath, projectConfig);
          }

          // Create directories based on mode
          if (isStructuredMode) {
            // Structured mode: create category directories
            for (const [category, relativePath] of Object.entries(projectConfig.migration_categories)) {
              const absolutePath = path.isAbsolute(relativePath)
                ? relativePath
                : path.join(projectPath, relativePath);

              try {
                await fs.access(absolutePath);
                createdDirs.push(`${category}: ${absolutePath} (already existed)`);
              } catch (error) {
                await fs.mkdir(absolutePath, { recursive: true });
                createdDirs.push(`${category}: ${absolutePath} (created)`);
              }
            }
          } else {
            // Simple mode: create single migrations directory
            const migrationsPathConfig = projectConfig.migrations_path;
            const migrationsPath = path.isAbsolute(migrationsPathConfig)
              ? migrationsPathConfig
              : path.join(projectPath, migrationsPathConfig);

            try {
              await fs.access(migrationsPath);
              createdDirs.push(`${migrationsPath} (already existed)`);
            } catch (error) {
              await fs.mkdir(migrationsPath, { recursive: true });
              createdDirs.push(`${migrationsPath} (created)`);
            }
          }

          // Set as active project
          activeProjectPath = projectPath;
          activeProjectConfig = projectConfig;

          // Create Flyway instance for this project
          const flywayConfig = {
            url: projectConfig.database_url,
            locations: isStructuredMode
              ? Object.values(projectConfig.migration_categories).map(p => `filesystem:${path.isAbsolute(p) ? p : path.join(projectPath, p)}`)
              : [`filesystem:${path.isAbsolute(projectConfig.migrations_path) ? projectConfig.migrations_path : path.join(projectPath, projectConfig.migrations_path)}`],
          };
          activeFlyway = new Flyway(flywayConfig);

          const mode = isStructuredMode ? 'structured' : 'simple';
          const dirsText = createdDirs.join('\n  ');

          return {
            content: [
              {
                type: 'text',
                text: `Project initialized successfully!\n\nProject: ${projectPath}\nMode: ${mode}\nDirectories:\n  ${dirsText}\nConfig: ${path.join(projectPath, '.flyway-mcp.json')}${configExisted ? ' (already existed)' : ' (created)'}\n\nThis project is now active. All migration operations will use this project's configuration.\n\nNext steps:\n1. Create migrations using 'create_migration'${isStructuredMode ? ' (specify category)' : ''}\n2. Apply migrations using 'flyway_migrate'`,
              },
            ],
          };
        }

        case 'update_migration_path': {
          const validatedArgs = UpdateMigrationPathSchema.parse(args);

          // Require project initialization
          requireInitializedProject();

          const newMigrationsPath = validatedArgs.new_migrations_path;
          const oldMigrationsPath = activeProjectConfig.migrations_path;

          // Update the config with new path
          const updatedConfig = {
            ...activeProjectConfig,
            migrations_path: newMigrationsPath,
          };

          await writeProjectConfig(activeProjectPath, updatedConfig);

          // Update active config in memory
          activeProjectConfig = updatedConfig;

          // Calculate absolute paths for display
          const oldAbsolutePath = path.isAbsolute(oldMigrationsPath)
            ? oldMigrationsPath
            : path.join(activeProjectPath, oldMigrationsPath);
          const newAbsolutePath = path.isAbsolute(newMigrationsPath)
            ? newMigrationsPath
            : path.join(activeProjectPath, newMigrationsPath);

          return {
            content: [
              {
                type: 'text',
                text: `Migration path updated successfully!\n\nProject: ${activeProjectPath}\nOld path: ${oldAbsolutePath}\nNew path: ${newAbsolutePath}\n\n⚠️  IMPORTANT: This tool only updated the config file.\nYou must manually move your migration files from the old location to the new location.\n\nSteps to complete the migration:\n1. Create the new directory: mkdir -p ${newAbsolutePath}\n2. Move migration files: mv ${oldAbsolutePath}/*.sql ${newAbsolutePath}/\n3. Verify files moved correctly\n4. Remove old directory if empty: rmdir ${oldAbsolutePath}`,
              },
            ],
          };
        }

        case 'flyway_info': {
          FlywayInfoSchema.parse(args);

          // Require project initialization
          requireInitializedProject();

          const result = await activeFlyway.info();
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(result, null, 2),
              },
            ],
          };
        }

        case 'flyway_migrate': {
          FlywayMigrateSchema.parse(args);

          // Require project initialization
          requireInitializedProject();

          const result = await activeFlyway.migrate();
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(result, null, 2),
              },
            ],
          };
        }

        case 'flyway_validate': {
          FlywayValidateSchema.parse(args);

          // Require project initialization
          requireInitializedProject();

          const result = await activeFlyway.validate();
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(result, null, 2),
              },
            ],
          };
        }

        case 'flyway_clean': {
          FlywayCleanSchema.parse(args);

          // Require project initialization
          requireInitializedProject();

          const result = await activeFlyway.clean();
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(result, null, 2),
              },
            ],
          };
        }

        case 'flyway_baseline': {
          const validatedArgs = FlywayBaselineSchema.parse(args);

          // Require project initialization
          requireInitializedProject();

          const result = await activeFlyway.baseline(validatedArgs);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(result, null, 2),
              },
            ],
          };
        }

        case 'flyway_repair': {
          FlywayRepairSchema.parse(args);

          // Require project initialization
          requireInitializedProject();

          const result = await activeFlyway.repair();
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(result, null, 2),
              },
            ],
          };
        }

        case 'create_migration': {
          const validatedArgs = CreateMigrationSchema.parse(args);

          // Require project initialization
          requireInitializedProject();

          // Get migration directory with category support
          const category = validatedArgs.category;
          const migrationDir = getMigrationsDirectory(config, category);

          // Ensure migration directory exists
          await fs.mkdir(migrationDir, { recursive: true });

          // Generate timestamp-based version number
          const timestamp = new Date().toISOString()
            .replace(/[-:T]/g, '')
            .replace(/\.\d+Z$/, '')
            .slice(0, 14); // YYYYMMDDHHmmss

          // Clean description for filename
          const cleanDescription = validatedArgs.description
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '_')
            .replace(/^_+|_+$/g, '');

          // Create migration filename following Flyway convention
          const filename = `V${timestamp}__${cleanDescription}.sql`;
          const filepath = path.join(migrationDir, filename);

          // Write migration file
          await fs.writeFile(filepath, validatedArgs.sql, 'utf8');

          const categoryInfo = category ? `\nCategory: ${category}` : '';

          return {
            content: [
              {
                type: 'text',
                text: `Migration file created successfully:\n\nPath: ${filepath}${categoryInfo}\nVersion: ${timestamp}\nDescription: ${cleanDescription}\n\nContent:\n${validatedArgs.sql}\n\nNext steps:\n1. Review the migration file\n2. Run 'flyway_migrate' to apply the migration`,
              },
            ],
          };
        }

        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new Error(`Invalid arguments: ${error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`);
      }
      throw error;
    }
  });

  return server;
}
