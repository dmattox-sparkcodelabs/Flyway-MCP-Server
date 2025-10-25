#!/usr/bin/env node

/**
 * Flyway MCP Server
 * Copyright (c) 2025 David Mattox @ SparkCodeLabs.com
 * Licensed under the MIT License. See LICENSE file in the project root.
 */

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createServer } from './server.js';

// Minimal config for backwards compatibility with getMigrationsDirectory fallback
// Note: Database connections are now per-project via initialize_project tool
const config = {
  locations: process.env.FLYWAY_LOCATIONS ? process.env.FLYWAY_LOCATIONS.split(',') : ['filesystem:./migrations'],
};

// Create MCP server (no global Flyway instance - each project creates its own)
const server = createServer(null, config);

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
