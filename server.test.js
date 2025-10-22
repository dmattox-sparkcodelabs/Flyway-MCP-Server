/**
 * Flyway MCP Server Integration Tests
 * Copyright (c) 2025 David Mattox @ SparkCodeLabs.com
 * Licensed under the MIT License. See LICENSE file in the project root.
 */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { createServer } from './server.js';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Flyway MCP Server Integration Tests', () => {
  let mockFlyway;
  let server;
  let testMigrationDir;

  beforeEach(() => {
    // Create mock Flyway instance
    mockFlyway = {
      info: jest.fn(),
      migrate: jest.fn(),
      validate: jest.fn(),
      clean: jest.fn(),
      baseline: jest.fn(),
      repair: jest.fn(),
    };

    testMigrationDir = path.join(__dirname, 'test-migrations-temp');

    const config = {
      locations: [`filesystem:${testMigrationDir}`],
    };

    server = createServer(mockFlyway, config);
  });

  afterEach(async () => {
    // Clean up test migrations directory
    try {
      const files = await fs.readdir(testMigrationDir);
      for (const file of files) {
        await fs.unlink(path.join(testMigrationDir, file));
      }
      await fs.rmdir(testMigrationDir);
    } catch (error) {
      // Directory might not exist
    }
  });

  describe('Server Initialization', () => {
    test('should create server instance', () => {
      expect(server).toBeDefined();
      expect(server._serverInfo.name).toBe('flyway-mcp');
      expect(server._serverInfo.version).toBe('1.0.0');
    });

    test('should have request handlers configured', () => {
      expect(server._requestHandlers).toBeDefined();
      expect(server._requestHandlers.size).toBeGreaterThan(0);
    });
  });

  describe('List Tools', () => {
    test('should list all 8 tools', async () => {
      const handler = server._requestHandlers.get('tools/list');
      expect(handler).toBeDefined();

      const result = await handler({ method: 'tools/list', params: {} });

      expect(result.tools).toHaveLength(8);
      expect(result.tools.map(t => t.name)).toEqual([
        'initialize_project',
        'flyway_info',
        'flyway_migrate',
        'flyway_validate',
        'flyway_clean',
        'flyway_baseline',
        'flyway_repair',
        'create_migration',
      ]);
    });

    test('each tool should have required properties', async () => {
      const handler = server._requestHandlers.get('tools/list');
      const result = await handler({ method: 'tools/list', params: {} });

      result.tools.forEach(tool => {
        expect(tool).toHaveProperty('name');
        expect(tool).toHaveProperty('description');
        expect(tool).toHaveProperty('inputSchema');
        expect(tool.description.length).toBeGreaterThan(0);
      });
    });
  });

  describe('flyway_info tool', () => {
    test('should call flyway.info() and return result', async () => {
      const mockInfo = {
        current: { version: '1.0', description: 'Initial' },
        pending: [],
      };
      mockFlyway.info.mockResolvedValue(mockInfo);

      const handler = server._requestHandlers.get('tools/call');
      const result = await handler({
        method: 'tools/call',
        params: {
          name: 'flyway_info',
          arguments: {},
        },
      });

      expect(mockFlyway.info).toHaveBeenCalledTimes(1);
      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('text');
      expect(JSON.parse(result.content[0].text)).toEqual(mockInfo);
    });

    test('should handle flyway.info() errors', async () => {
      mockFlyway.info.mockRejectedValue(new Error('Database connection failed'));

      const handler = server._requestHandlers.get('tools/call');

      await expect(handler({
        method: 'tools/call',
        params: {
          name: 'flyway_info',
          arguments: {},
        },
      })).rejects.toThrow('Database connection failed');
    });
  });

  describe('flyway_migrate tool', () => {
    test('should call flyway.migrate() and return result', async () => {
      const mockMigrate = {
        migrationsExecuted: 2,
        success: true,
      };
      mockFlyway.migrate.mockResolvedValue(mockMigrate);

      const handler = server._requestHandlers.get('tools/call');
      const result = await handler({
        method: 'tools/call',
        params: {
          name: 'flyway_migrate',
          arguments: {},
        },
      });

      expect(mockFlyway.migrate).toHaveBeenCalledTimes(1);
      expect(result.content).toHaveLength(1);
      expect(JSON.parse(result.content[0].text)).toEqual(mockMigrate);
    });
  });

  describe('flyway_validate tool', () => {
    test('should call flyway.validate() and return result', async () => {
      const mockValidate = {
        validationSuccessful: true,
        errorCount: 0,
      };
      mockFlyway.validate.mockResolvedValue(mockValidate);

      const handler = server._requestHandlers.get('tools/call');
      const result = await handler({
        method: 'tools/call',
        params: {
          name: 'flyway_validate',
          arguments: {},
        },
      });

      expect(mockFlyway.validate).toHaveBeenCalledTimes(1);
      expect(JSON.parse(result.content[0].text)).toEqual(mockValidate);
    });
  });

  describe('flyway_clean tool', () => {
    test('should call flyway.clean() and return result', async () => {
      const mockClean = {
        schemasDropped: ['public'],
        success: true,
      };
      mockFlyway.clean.mockResolvedValue(mockClean);

      const handler = server._requestHandlers.get('tools/call');
      const result = await handler({
        method: 'tools/call',
        params: {
          name: 'flyway_clean',
          arguments: {},
        },
      });

      expect(mockFlyway.clean).toHaveBeenCalledTimes(1);
      expect(JSON.parse(result.content[0].text)).toEqual(mockClean);
    });
  });

  describe('flyway_baseline tool', () => {
    test('should call flyway.baseline() with no args', async () => {
      const mockBaseline = {
        baselineVersion: '1',
        success: true,
      };
      mockFlyway.baseline.mockResolvedValue(mockBaseline);

      const handler = server._requestHandlers.get('tools/call');
      const result = await handler({
        method: 'tools/call',
        params: {
          name: 'flyway_baseline',
          arguments: {},
        },
      });

      expect(mockFlyway.baseline).toHaveBeenCalledTimes(1);
      expect(mockFlyway.baseline).toHaveBeenCalledWith({});
      expect(JSON.parse(result.content[0].text)).toEqual(mockBaseline);
    });

    test('should call flyway.baseline() with version and description', async () => {
      const mockBaseline = {
        baselineVersion: '2.0',
        baselineDescription: 'Initial baseline',
        success: true,
      };
      mockFlyway.baseline.mockResolvedValue(mockBaseline);

      const handler = server._requestHandlers.get('tools/call');
      await handler({
        method: 'tools/call',
        params: {
          name: 'flyway_baseline',
          arguments: {
            baselineVersion: '2.0',
            baselineDescription: 'Initial baseline',
          },
        },
      });

      expect(mockFlyway.baseline).toHaveBeenCalledWith({
        baselineVersion: '2.0',
        baselineDescription: 'Initial baseline',
      });
    });
  });

  describe('flyway_repair tool', () => {
    test('should call flyway.repair() and return result', async () => {
      const mockRepair = {
        repairActions: ['Removed failed migration entry'],
        success: true,
      };
      mockFlyway.repair.mockResolvedValue(mockRepair);

      const handler = server._requestHandlers.get('tools/call');
      const result = await handler({
        method: 'tools/call',
        params: {
          name: 'flyway_repair',
          arguments: {},
        },
      });

      expect(mockFlyway.repair).toHaveBeenCalledTimes(1);
      expect(JSON.parse(result.content[0].text)).toEqual(mockRepair);
    });
  });

  describe('create_migration tool', () => {
    test('should create migration file with correct name and content', async () => {
      const description = 'create_users_table';
      const sql = 'CREATE TABLE users (id SERIAL PRIMARY KEY, name VARCHAR(255));';

      const handler = server._requestHandlers.get('tools/call');
      const result = await handler({
        method: 'tools/call',
        params: {
          name: 'create_migration',
          arguments: {
            description,
            sql,
          },
        },
      });

      // Verify directory was created
      const dirExists = await fs.access(testMigrationDir).then(() => true).catch(() => false);
      expect(dirExists).toBe(true);

      // Verify file was created
      const files = await fs.readdir(testMigrationDir);
      expect(files).toHaveLength(1);

      const filename = files[0];
      expect(filename).toMatch(/^V\d{14}__create_users_table\.sql$/);

      // Verify file content
      const filepath = path.join(testMigrationDir, filename);
      const content = await fs.readFile(filepath, 'utf8');
      expect(content).toBe(sql);

      // Verify response
      expect(result.content[0].text).toContain('Migration file created successfully');
      expect(result.content[0].text).toContain(filepath);
    });

    test('should sanitize description correctly', async () => {
      const description = 'Create Users Table!!!';
      const sql = 'CREATE TABLE users (id SERIAL);';

      const handler = server._requestHandlers.get('tools/call');
      await handler({
        method: 'tools/call',
        params: {
          name: 'create_migration',
          arguments: { description, sql },
        },
      });

      const files = await fs.readdir(testMigrationDir);
      const filename = files[0];

      expect(filename).toMatch(/^V\d{14}__create_users_table\.sql$/);
    });

    test('should reject missing description', async () => {
      const handler = server._requestHandlers.get('tools/call');

      await expect(handler({
        method: 'tools/call',
        params: {
          name: 'create_migration',
          arguments: {
            sql: 'CREATE TABLE test (id SERIAL);',
          },
        },
      })).rejects.toThrow('Invalid arguments');
    });

    test('should reject missing sql', async () => {
      const handler = server._requestHandlers.get('tools/call');

      await expect(handler({
        method: 'tools/call',
        params: {
          name: 'create_migration',
          arguments: {
            description: 'test_migration',
          },
        },
      })).rejects.toThrow('Invalid arguments');
    });
  });

  describe('Error Handling', () => {
    test('should throw error for unknown tool', async () => {
      const handler = server._requestHandlers.get('tools/call');

      await expect(handler({
        method: 'tools/call',
        params: {
          name: 'unknown_tool',
          arguments: {},
        },
      })).rejects.toThrow('Unknown tool: unknown_tool');
    });

    test('should handle validation errors with helpful messages', async () => {
      const handler = server._requestHandlers.get('tools/call');

      await expect(handler({
        method: 'tools/call',
        params: {
          name: 'create_migration',
          arguments: {
            description: 123, // Should be string
            sql: 'CREATE TABLE test (id SERIAL);',
          },
        },
      })).rejects.toThrow('Invalid arguments');
    });
  });

  describe('initialize_project tool', () => {
    const testProjectDir = path.join(__dirname, 'test-project-init');

    afterEach(async () => {
      // Clean up test project directory
      try {
        await fs.rm(testProjectDir, { recursive: true, force: true });
      } catch (error) {
        // Directory might not exist
      }
    });

    test('should initialize project with migrations directory', async () => {
      // Create test project directory
      await fs.mkdir(testProjectDir, { recursive: true });

      const handler = server._requestHandlers.get('tools/call');
      const result = await handler({
        method: 'tools/call',
        params: {
          name: 'initialize_project',
          arguments: {
            project_path: testProjectDir,
          },
        },
      });

      // Verify response
      expect(result.content[0].text).toContain('Project initialized successfully');
      expect(result.content[0].text).toContain(testProjectDir);

      // Verify migrations directory was created
      const migrationsPath = path.join(testProjectDir, 'migrations');
      const migrationsExists = await fs.access(migrationsPath).then(() => true).catch(() => false);
      expect(migrationsExists).toBe(true);

      // Verify config file was created
      const configPath = path.join(testProjectDir, '.flyway-mcp.json');
      const configExists = await fs.access(configPath).then(() => true).catch(() => false);
      expect(configExists).toBe(true);

      // Verify config content
      const configContent = await fs.readFile(configPath, 'utf8');
      const config = JSON.parse(configContent);
      expect(config).toHaveProperty('migrations_path', './migrations');
      expect(config).toHaveProperty('created_at');
    });

    test('should handle existing migrations directory', async () => {
      // Create test project directory with existing migrations
      await fs.mkdir(path.join(testProjectDir, 'migrations'), { recursive: true });

      const handler = server._requestHandlers.get('tools/call');
      const result = await handler({
        method: 'tools/call',
        params: {
          name: 'initialize_project',
          arguments: {
            project_path: testProjectDir,
          },
        },
      });

      expect(result.content[0].text).toContain('already existed');
    });

    test('should reject non-existent project directory', async () => {
      const nonExistentPath = path.join(__dirname, 'does-not-exist-12345');

      const handler = server._requestHandlers.get('tools/call');

      await expect(handler({
        method: 'tools/call',
        params: {
          name: 'initialize_project',
          arguments: {
            project_path: nonExistentPath,
          },
        },
      })).rejects.toThrow('Project directory does not exist');
    });
  });
});
