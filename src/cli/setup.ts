#!/usr/bin/env node

/**
 * `npx productbrain setup`
 *
 * Guided onboarding: get API key from SynergyOS, paste it, and write MCP config.
 * No GitHub — keys come from SynergyOS → Settings → API Keys.
 */

import { createInterface } from "node:readline";
import { detectClients, writeClientConfig, type McpClientInfo } from "./config-writer.js";

const SYNERGYOS_APP_URL =
  process.env.SYNERGYOS_APP_URL ?? process.env.PRODUCTBRAIN_APP_URL ?? "http://localhost:5173";

// ── Helpers ─────────────────────────────────────────────────────────────

function bold(s: string) {
  return `\x1b[1m${s}\x1b[0m`;
}
function green(s: string) {
  return `\x1b[32m${s}\x1b[0m`;
}
function dim(s: string) {
  return `\x1b[2m${s}\x1b[0m`;
}
function orange(s: string) {
  return `\x1b[33m${s}\x1b[0m`;
}

function log(msg: string) {
  process.stdout.write(`${msg}\n`);
}

function openBrowser(url: string) {
  const { execSync } = require("node:child_process") as typeof import("node:child_process");
  const platform = process.platform;
  try {
    if (platform === "darwin") execSync(`open "${url}"`);
    else if (platform === "win32") execSync(`start "" "${url}"`);
    else execSync(`xdg-open "${url}"`);
  } catch {
    log(dim(`  Could not open browser automatically.`));
    log(`  Open this URL manually: ${url}`);
  }
}

function prompt(question: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

function promptChoice(question: string, choices: string[]): Promise<number> {
  return new Promise((resolve) => {
    log("");
    log(bold(question));
    choices.forEach((c, i) => log(`  ${i + 1}) ${c}`));
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    rl.question(`\n  ${dim("Choice [1]:")} `, (line) => {
      rl.close();
      const n = parseInt(line.trim(), 10);
      if (isNaN(n) || n < 1 || n > choices.length) {
        resolve(0);
      } else {
        resolve(n - 1);
      }
    });
  });
}

// ── Main ────────────────────────────────────────────────────────────────

export async function runSetup() {
  log("");
  log(bold(`  Product${orange("Brain")} Setup`));
  log(dim("  Connect your AI assistant to your knowledge base\n"));

  const apiKeysUrl = `${SYNERGYOS_APP_URL}/settings/api-keys`;

  log(`  ${dim("1. Get your API key from SynergyOS")}`);
  log(`     ${dim(apiKeysUrl)}\n`);

  const openNow = await prompt(`  Open this URL in your browser? [Y/n]: `);
  if (openNow.toLowerCase() !== "n" && openNow.toLowerCase() !== "no") {
    openBrowser(apiKeysUrl);
  }

  log("");
  log(`  ${dim("2. Generate a key (if you don't have one), then copy it.\n")}`);

  const apiKey = await prompt(`  Paste your API key (pb_sk_...): `);

  if (!apiKey || !apiKey.startsWith("pb_sk_")) {
    log(`  ${orange("!")} Invalid key format. Keys start with pb_sk_.`);
    log(`  Get one at ${apiKeysUrl}\n`);
    process.exit(1);
  }

  log(`  ${green("✓")} Key received\n`);

  // 3. Detect MCP clients and write config
  const clients = detectClients();

  if (clients.length === 0) {
    log(bold("  No supported MCP clients detected.\n"));
    printConfigSnippet(apiKey);
    return;
  }

  const clientNames = clients.map((c) => c.name);
  const allOption =
    clients.length > 1
      ? [...clientNames, "All of the above", "Just show me the config"]
      : [...clientNames, "Just show me the config"];

  const choice = await promptChoice("Which AI assistant should I configure?", allOption);

  if (choice === allOption.length - 1) {
    printConfigSnippet(apiKey);
  } else if (clients.length > 1 && choice === allOption.length - 2) {
    for (const client of clients) {
      await writeConfig(client, apiKey);
    }
  } else {
    await writeConfig(clients[choice], apiKey);
  }

  log("");
  log(
    `  ${green("✓")} Done! Restart your AI assistant and try: ${bold('"Use the health tool"')}`,
  );
  log("");
}

async function writeConfig(client: McpClientInfo, apiKey: string) {
  try {
    const wrote = await writeClientConfig(client, apiKey);
    if (wrote) {
      log(`  ${green("✓")} Wrote config to ${dim(client.configPath)}`);
    } else {
      log(`  ${dim("ℹ")} ${client.name} already configured — skipped`);
    }
  } catch (err: any) {
    log(`  ${orange("!")} Could not write ${client.name} config: ${err.message}`);
    printConfigSnippet(apiKey);
  }
}

function printConfigSnippet(apiKey: string) {
  log("");
  log(bold("  Add this to your MCP client config:\n"));
  const snippet = JSON.stringify(
    {
      mcpServers: {
        productbrain: {
          command: "npx",
          args: ["-y", "productbrain"],
          env: { PRODUCTBRAIN_API_KEY: apiKey },
        },
      },
    },
    null,
    2,
  );
  for (const line of snippet.split("\n")) {
    log(`    ${line}`);
  }
  log("");
}
