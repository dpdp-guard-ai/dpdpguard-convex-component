#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Regenerates src/component/generated/api-types.ts from the openapi/v1.yaml
 * shipped inside the installed @dpdpguard/contract package (not a copy —
 * always the exact file that version of the contract published). Mirrors
 * dpdpguard-server-node-sdk/scripts/codegen.mjs so both SDKs derive from the
 * same source of truth the same way. Run after every npm install/update of
 * @dpdpguard/contract, or via `npm run codegen`.
 */
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const specPath = join(
	repoRoot,
	"node_modules",
	"@dpdpguard",
	"contract",
	"openapi",
	"v1.yaml",
);
const outPath = join(
	repoRoot,
	"src",
	"component",
	"generated",
	"api-types.ts",
);

if (!existsSync(specPath)) {
	console.error(
		`codegen: ${specPath} not found — is @dpdpguard/contract installed? Run npm install first.`,
	);
	process.exit(1);
}

const result = spawnSync(
	"npx",
	["--yes", "openapi-typescript@7", specPath, "-o", outPath],
	{ stdio: "inherit", shell: process.platform === "win32" },
);

process.exit(result.status ?? 1);
