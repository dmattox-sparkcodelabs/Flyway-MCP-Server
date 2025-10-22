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
});

export const InitializeProjectSchema = z.object({
  project_path: z.string().describe('Absolute path to the project directory'),
});

// Module-level state for active project
let activeProjectPath = null;
let activeProjectConfig = null;

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
 */
function getMigrationsDirectory(globalConfig) {
  if (activeProjectConfig && activeProjectConfig.migrations_path) {
    // Use project-specific migrations path
    const migrationsPath = activeProjectConfig.migrations_path;
    if (path.isAbsolute(migrationsPath)) {
      return migrationsPath;
    } else {
      return path.join(activeProjectPath, migrationsPath);
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
          description: 'Initialize Flyway for a project. Creates migrations directory if needed and generates .flyway-mcp.json config file. Sets this project as active for all subsequent migration operations.',
          inputSchema: {
            type: 'object',
            properties: {
              project_path: {
                type: 'string',
                description: 'Absolute path to the project directory (e.g., /home/user/my-project)',
              },
            },
            required: ['project_path'],
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
          description: 'Create a new Flyway migration file with the proper naming convention and content. This is the ONLY way to create schema changes.',
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

          // Check for existing migrations directory
          const migrationsPath = path.join(projectPath, 'migrations');
          let migrationsExist = false;
          try {
            await fs.access(migrationsPath);
            migrationsExist = true;
          } catch (error) {
            // Migrations directory doesn't exist, will create it
          }

          // Create migrations directory if it doesn't exist
          if (!migrationsExist) {
            await fs.mkdir(migrationsPath, { recursive: true });
          }

          // Create or update .flyway-mcp.json
          const projectConfig = {
            migrations_path: './migrations',
            created_at: new Date().toISOString(),
          };

          await writeProjectConfig(projectPath, projectConfig);

          // Set as active project
          activeProjectPath = projectPath;
          activeProjectConfig = projectConfig;

          return {
            content: [
              {
                type: 'text',
                text: `Project initialized successfully!\n\nProject: ${projectPath}\nMigrations: ${migrationsPath}${migrationsExist ? ' (already existed)' : ' (created)'}\nConfig: ${path.join(projectPath, '.flyway-mcp.json')} (created)\n\nThis project is now active. All migration operations will use this project's configuration.\n\nNext steps:\n1. Create migrations using 'create_migration'\n2. Apply migrations using 'flyway_migrate'`,
              },
            ],
          };
        }

        case 'flyway_info': {
          FlywayInfoSchema.parse(args);
          const result = await flyway.info();
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
          const result = await flyway.migrate();
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
          const result = await flyway.validate();
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
          const result = await flyway.clean();
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
          const result = await flyway.baseline(validatedArgs);
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
          const result = await flyway.repair();
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

          // Get migration directory (uses active project if set, otherwise global config)
          const migrationDir = getMigrationsDirectory(config);

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

          return {
            content: [
              {
                type: 'text',
                text: `Migration file created successfully:\n\nPath: ${filepath}\nVersion: ${timestamp}\nDescription: ${cleanDescription}\n\nContent:\n${validatedArgs.sql}\n\nNext steps:\n1. Review the migration file\n2. Run 'flyway_migrate' to apply the migration`,
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
