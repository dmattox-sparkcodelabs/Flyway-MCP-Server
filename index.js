#!/usr/bin/env node

/**
 * Flyway MCP Server
 * Copyright (c) 2025 David Mattox @ SparkCodeLabs.com
 * Licensed under the MIT License. See LICENSE file in the project root.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { Flyway } from 'node-flyway';
import { z } from 'zod';
import fs from 'fs/promises';
import path from 'path';

// Validation schemas
const FlywayInfoSchema = z.object({});

const FlywayMigrateSchema = z.object({});

const FlywayValidateSchema = z.object({});

const FlywayCleanSchema = z.object({});

const FlywayBaselineSchema = z.object({
  baselineVersion: z.string().optional(),
  baselineDescription: z.string().optional(),
});

const FlywayRepairSchema = z.object({});

const CreateMigrationSchema = z.object({
  description: z.string().describe('Description of the migration (e.g., "create_users_table")'),
  sql: z.string().describe('SQL content for the migration'),
});

// Get configuration from environment variables
const config = {
  url: process.env.FLYWAY_URL || process.env.POSTGRES_CONNECTION_STRING,
  user: process.env.FLYWAY_USER,
  password: process.env.FLYWAY_PASSWORD,
  locations: process.env.FLYWAY_LOCATIONS ? process.env.FLYWAY_LOCATIONS.split(',') : ['filesystem:./migrations'],
  baselineOnMigrate: process.env.FLYWAY_BASELINE_ON_MIGRATE === 'true',
};

// Validate required configuration
if (!config.url) {
  console.error('Error: FLYWAY_URL or POSTGRES_CONNECTION_STRING environment variable is required');
  process.exit(1);
}

// Initialize Flyway
const flyway = new Flyway(config);

// Create MCP server
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
        
        // Get migration directory from config
        let migrationDir = './migrations';
        if (config.locations && config.locations.length > 0) {
          const location = config.locations[0];
          if (location.startsWith('filesystem:')) {
            migrationDir = location.replace('filesystem:', '');
          }
        }

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

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Flyway MCP Server running on stdio');
}

main().catch((error) => {
  console.error('Server error:', error);
  process.exit(1);
});
