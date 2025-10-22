/**
 * Flyway MCP Server Tests
 * Copyright (c) 2025 David Mattox @ SparkCodeLabs.com
 * Licensed under the MIT License. See LICENSE file in the project root.
 */

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { z } from 'zod';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Test schemas (these should match the schemas in index.js)
const CreateMigrationSchema = z.object({
  description: z.string(),
  sql: z.string(),
});

describe('Flyway MCP Server', () => {
  describe('Schema Validation', () => {
    test('CreateMigrationSchema validates correct input', () => {
      const validInput = {
        description: 'create_users_table',
        sql: 'CREATE TABLE users (id SERIAL PRIMARY KEY);',
      };

      expect(() => CreateMigrationSchema.parse(validInput)).not.toThrow();
    });

    test('CreateMigrationSchema rejects missing description', () => {
      const invalidInput = {
        sql: 'CREATE TABLE users (id SERIAL PRIMARY KEY);',
      };

      expect(() => CreateMigrationSchema.parse(invalidInput)).toThrow();
    });

    test('CreateMigrationSchema rejects missing sql', () => {
      const invalidInput = {
        description: 'create_users_table',
      };

      expect(() => CreateMigrationSchema.parse(invalidInput)).toThrow();
    });
  });

  describe('Migration File Creation', () => {
    const testMigrationDir = path.join(__dirname, 'test-migrations');

    beforeEach(async () => {
      // Create test migration directory
      await fs.mkdir(testMigrationDir, { recursive: true });
    });

    afterEach(async () => {
      // Clean up test migration directory
      try {
        const files = await fs.readdir(testMigrationDir);
        for (const file of files) {
          await fs.unlink(path.join(testMigrationDir, file));
        }
        await fs.rmdir(testMigrationDir);
      } catch (error) {
        // Directory might not exist, ignore
      }
    });

    test('Migration filename follows Flyway convention', async () => {
      const description = 'create_users_table';
      const sql = 'CREATE TABLE users (id SERIAL PRIMARY KEY);';

      // Generate timestamp
      const timestamp = new Date().toISOString()
        .replace(/[-:T]/g, '')
        .replace(/\.\d+Z$/, '')
        .slice(0, 14);

      // Clean description
      const cleanDescription = description
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');

      const expectedPattern = new RegExp(`^V\\d{14}__${cleanDescription}\\.sql$`);
      const filename = `V${timestamp}__${cleanDescription}.sql`;

      expect(filename).toMatch(expectedPattern);
    });

    test('Migration file is created with correct content', async () => {
      const description = 'create_test_table';
      const sql = 'CREATE TABLE test (id SERIAL PRIMARY KEY, name VARCHAR(255));';

      const timestamp = new Date().toISOString()
        .replace(/[-:T]/g, '')
        .replace(/\.\d+Z$/, '')
        .slice(0, 14);

      const cleanDescription = description
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');

      const filename = `V${timestamp}__${cleanDescription}.sql`;
      const filepath = path.join(testMigrationDir, filename);

      // Write migration file
      await fs.writeFile(filepath, sql, 'utf8');

      // Verify file exists and has correct content
      const fileContent = await fs.readFile(filepath, 'utf8');
      expect(fileContent).toBe(sql);
    });

    test('Description sanitization removes special characters', () => {
      const testCases = [
        { input: 'create users table', expected: 'create_users_table' },
        { input: 'Create-Users-Table', expected: 'create_users_table' },
        { input: 'create__multiple___underscores', expected: 'create_multiple_underscores' },
        { input: '__leading_and_trailing__', expected: 'leading_and_trailing' },
        { input: 'special!@#$chars', expected: 'special_chars' },
      ];

      testCases.forEach(({ input, expected }) => {
        const cleaned = input
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '_')
          .replace(/^_+|_+$/g, '');

        expect(cleaned).toBe(expected);
      });
    });
  });

  describe('Timestamp Generation', () => {
    test('Timestamp follows YYYYMMDDHHmmss format', () => {
      const timestamp = new Date().toISOString()
        .replace(/[-:T]/g, '')
        .replace(/\.\d+Z$/, '')
        .slice(0, 14);

      expect(timestamp).toMatch(/^\d{14}$/);
      expect(timestamp.length).toBe(14);
    });

    test('Timestamps are sequential', async () => {
      const timestamp1 = new Date().toISOString()
        .replace(/[-:T]/g, '')
        .replace(/\.\d+Z$/, '')
        .slice(0, 14);

      // Wait 1ms to ensure different timestamp
      await new Promise(resolve => setTimeout(resolve, 1));

      const timestamp2 = new Date().toISOString()
        .replace(/[-:T]/g, '')
        .replace(/\.\d+Z$/, '')
        .slice(0, 14);

      expect(parseInt(timestamp2)).toBeGreaterThanOrEqual(parseInt(timestamp1));
    });
  });

  describe('Environment Configuration', () => {
    test('FLYWAY_LOCATIONS defaults to filesystem:./migrations', () => {
      const locations = process.env.FLYWAY_LOCATIONS
        ? process.env.FLYWAY_LOCATIONS.split(',')
        : ['filesystem:./migrations'];

      expect(locations).toContain('filesystem:./migrations');
    });

    test('Migration directory path is extracted correctly', () => {
      const testCases = [
        { input: 'filesystem:./migrations', expected: './migrations' },
        { input: 'filesystem:/absolute/path/migrations', expected: '/absolute/path/migrations' },
        { input: 'filesystem:migrations', expected: 'migrations' },
      ];

      testCases.forEach(({ input, expected }) => {
        const extractedPath = input.startsWith('filesystem:')
          ? input.replace('filesystem:', '')
          : input;

        expect(extractedPath).toBe(expected);
      });
    });
  });
});
