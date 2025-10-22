#!/usr/bin/env node

/**
 * Test script to check MCP context awareness
 */

console.error('=== MCP Context Test ===');
console.error('Current Working Directory:', process.cwd());
console.error('Script Location:', import.meta.url);
console.error('Environment Variables:');
console.error('  HOME:', process.env.HOME);
console.error('  PWD:', process.env.PWD);
console.error('  INIT_CWD:', process.env.INIT_CWD);
console.error('========================');
