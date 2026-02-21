#!/usr/bin/env node

/**
 * `npx productbrain setup`
 *
 * Guided onboarding: authenticate via GitHub, create a workspace,
 * generate an API key, and write MCP client config files.
 */

import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { randomBytes } from "node:crypto";
import { detectClients, writeClientConfig, type McpClientInfo } from "./config-writer.js";

const DEFAULT_CLOUD_URL = "https://earnest-sheep-635.convex.site";
const CLOUD_URL = process.env.PRODUCTBRAIN_URL ?? DEFAULT_CLOUD_URL;

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

// ── Localhost callback server ───────────────────────────────────────────

interface CallbackResult {
  token: string;
  nonce: string;
}

function startCallbackServer(
  expectedNonce: string,
): Promise<{ result: Promise<CallbackResult>; port: number; close: () => void }> {
  return new Promise((resolveServer) => {
    let resolveResult: (r: CallbackResult) => void;
    const resultPromise = new Promise<CallbackResult>((r) => {
      resolveResult = r;
    });

    const server = createServer((req: IncomingMessage, res: ServerResponse) => {
      const url = new URL(req.url ?? "/", `http://localhost`);

      if (url.pathname === "/callback") {
        const token = url.searchParams.get("token") ?? "";
        const nonce = url.searchParams.get("nonce") ?? "";

        if (nonce !== expectedNonce) {
          res.writeHead(400, { "Content-Type": "text/html" });
          res.end("<h1>Invalid nonce — please try again.</h1>");
          return;
        }

        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(
          `<!DOCTYPE html><html><head><style>body{font-family:system-ui;background:#0a0a0f;color:#e4e4e7;display:flex;align-items:center;justify-content:center;min-height:100vh}` +
            `.card{background:#18181b;border:1px solid #27272a;border-radius:16px;padding:48px 40px;text-align:center}` +
            `h1{font-size:20px;margin-bottom:8px}p{color:#71717a;font-size:14px}</style></head>` +
            `<body><div class="card"><div style="font-size:48px;margin-bottom:16px">&#10003;</div>` +
            `<h1>Authenticated</h1><p>You can close this tab and return to your terminal.</p></div></body></html>`,
        );

        resolveResult!({ token, nonce });
      } else {
        res.writeHead(404);
        res.end("Not found");
      }
    });

    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      const port = typeof addr === "object" && addr ? addr.port : 0;
      resolveServer({
        result: resultPromise,
        port,
        close: () => server.close(),
      });
    });
  });
}

// ── Provisioning ────────────────────────────────────────────────────────

async function provision(sessionToken: string): Promise<{
  apiKey: string;
  workspaceSlug: string;
  userName: string;
}> {
  const res = await fetch(`${CLOUD_URL}/api/provision`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${sessionToken}`,
    },
  });

  const json = (await res.json()) as { data?: any; error?: string };
  if (!res.ok || json.error) {
    throw new Error(`Provisioning failed: ${json.error ?? `HTTP ${res.status}`}`);
  }

  return json.data;
}

// ── Interactive prompt (minimal, no dependencies) ───────────────────────

function prompt(question: string, choices: string[]): Promise<number> {
  return new Promise((resolve) => {
    log("");
    log(bold(question));
    choices.forEach((c, i) => log(`  ${i + 1}) ${c}`));
    process.stdout.write(`\n  ${dim("Choice [1]:")} `);

    const rl = require("node:readline").createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: false,
    });

    rl.on("line", (line: string) => {
      rl.close();
      const n = parseInt(line.trim(), 10);
      if (isNaN(n) || n < 1 || n > choices.length) {
        resolve(0); // default to first
      } else {
        resolve(n - 1);
      }
    });
  });
}

// ── Main ────────────────────────────────────────────────────────────────

export async function runSetup() {
  log("");
  log(bold(`  Product${orange("Brain")} Cloud Setup`));
  log(dim("  Connect your AI assistant to your knowledge base\n"));

  // 1. Start localhost callback server
  const nonce = randomBytes(16).toString("hex");
  const { result: callbackResult, port, close } = await startCallbackServer(nonce);

  // 2. Open browser for GitHub auth
  const loginUrl = `${CLOUD_URL}/auth/login?port=${port}&nonce=${nonce}`;
  log(`  ${dim("Opening browser for GitHub sign-in...")}`);
  openBrowser(loginUrl);
  log(`  ${dim("Waiting for authentication...")}\n`);

  // 3. Wait for callback
  let sessionToken: string;
  try {
    const result = await callbackResult;
    sessionToken = result.token;
  } finally {
    close();
  }

  log(`  ${green("✓")} Authenticated\n`);

  // 4. Provision workspace + API key
  log(`  ${dim("Creating workspace and API key...")}`);
  const { apiKey, workspaceSlug, userName } = await provision(sessionToken);
  log(`  ${green("✓")} Workspace ${bold(workspaceSlug)} ready for ${bold(userName)}\n`);

  // 5. Detect MCP clients and write config
  const clients = detectClients();

  if (clients.length === 0) {
    log(bold("  No supported MCP clients detected.\n"));
    printConfigSnippet(apiKey);
    return;
  }

  const clientNames = clients.map((c) => c.name);
  const allOption =
    clients.length > 1 ? [...clientNames, "All of the above", "Just show me the config"] : [...clientNames, "Just show me the config"];

  const choice = await prompt("Which AI assistant should I configure?", allOption);

  if (choice === allOption.length - 1) {
    // "Just show me the config"
    printConfigSnippet(apiKey);
  } else if (clients.length > 1 && choice === allOption.length - 2) {
    // "All of the above"
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
