#!/usr/bin/env node

/**
 * ProductBrain CLI entry point.
 *
 * Usage:
 *   npx productbrain           → starts the MCP server (default)
 *   npx productbrain setup     → guided onboarding flow
 */

export {};

const subcommand = process.argv[2];

if (subcommand === "setup") {
  const { runSetup } = await import("./setup.js");
  await runSetup();
} else {
  // Default: start the MCP server
  await import("../index.js");
}
