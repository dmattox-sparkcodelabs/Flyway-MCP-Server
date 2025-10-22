#!/usr/bin/env node

/**
 * Flyway MCP Server
 * Copyright (c) 2025 David Mattox @ SparkCodeLabs.com
 * Licensed under the MIT License. See LICENSE file in the project root.
 */

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { Flyway } from 'node-flyway';
import { createServer } from './server.js';

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
const server = createServer(flyway, config);

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
