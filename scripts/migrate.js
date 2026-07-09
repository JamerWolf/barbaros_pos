#!/usr/bin/env node
/**
 * Migration wrapper with production guardrails.
 *
 * Why this exists: Prisma's `migrate dev`, `db push --force-reset`, and
 * `migrate reset` are DESTRUCTIVE. If an AI agent (or a tired dev) runs
 * them against production, the database gets wiped.
 *
 * Rules:
 *   APP_ENV=develop  → anything goes (migrate dev, db push, seed, reset)
 *   APP_ENV=production → ONLY `migrate deploy` is allowed.
 *                       `migrate dev`, `db push --force-reset`,
 *                       `db push --accept-data-loss`, `migrate reset`,
 *                       and `db seed` are HARD-BLOCKED.
 *
 * Usage:
 *   APP_ENV=develop    node scripts/migrate.js deploy
 *   APP_ENV=production node scripts/migrate.js deploy      # OK
 *   APP_ENV=production node scripts/migrate.js dev         # BLOCKED
 *   APP_ENV=production node scripts/migrate.js "db push"   # BLOCKED
 */
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { config as loadEnv } from 'dotenv';

const VALID_ENVS = new Set(['develop', 'production']);
const DESTRUCTIVE_SUBCOMMANDS = new Set([
  'dev',
  'reset',
  'migrate:dev',
  'migrate:reset',
  'db:push',
  'db:seed',
  'db:reset',
]);

// ---- 1. Validate APP_ENV (fail fast) ------------------------------------
const env = process.env.APP_ENV;
if (!env || !VALID_ENVS.has(env)) {
  console.error(
    `[migrate] APP_ENV="${env ?? ''}" is not set or invalid. ` +
      'Must be one of: develop | production. Aborting.'
  );
  process.exit(2);
}

// ---- 2. Load the right .env file (same loader as the API) ----------------
const envDir = resolve(process.cwd(), 'apps/api');
const envFile = resolve(envDir, `.env.${env}`);
if (!existsSync(envFile)) {
  console.error(`[migrate] Expected env file not found: ${envFile}`);
  process.exit(2);
}
loadEnv({ path: envFile, override: false });
const localEnv = resolve(envDir, '.env');
if (existsSync(localEnv)) {
  loadEnv({ path: localEnv, override: false });
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error(`[migrate] DATABASE_URL is not set after loading ${envFile}.`);
  process.exit(2);
}

const redactedUrl = databaseUrl.replace(/:[^:@/]+@/, ':***@');
console.log(`[migrate] APP_ENV=${env} target=${redactedUrl}`);

// ---- 3. Parse and validate the requested command --------------------------
const argv = process.argv.slice(2);
const subcommand = argv[0];

if (!subcommand) {
  console.error(
    '[migrate] Usage: node scripts/migrate.js <subcommand> [...args]\n' +
      '  e.g. node scripts/migrate.js deploy\n' +
      '        node scripts/migrate.js "db push"'
  );
  process.exit(2);
}

// Normalize multi-word subcommands like `migrate dev` → `migrate:dev`
// and `db push` → `db:push` so the rest of the script can check a single token.
const normalized =
  (subcommand === 'migrate' || subcommand === 'db') && argv[1]
    ? `${subcommand}:${argv[1]}`
    : subcommand;

// Block destructive subcommands in production
if (env === 'production' && DESTRUCTIVE_SUBCOMMANDS.has(normalized)) {
  console.error(
    `[migrate] BLOCKED: '${normalized}' is not allowed in APP_ENV=production. ` +
      'This subcommand can wipe the database. Use `deploy` for non-destructive migrations.'
  );
  process.exit(3);
}

// Block destructive flags in production
if (env === 'production') {
  const argsJoined = argv.join(' ');
  const dangerousFlags = [
    '--force-reset',
    '--accept-data-loss',
    '--skip-generate',
  ];
  for (const flag of dangerousFlags) {
    if (argsJoined.includes(flag)) {
      console.error(
        `[migrate] BLOCKED: flag '${flag}' is not allowed in APP_ENV=production.`
      );
      process.exit(3);
    }
  }

  // Allowlist: only safe commands are permitted in production.
  // Each entry can be invoked as either `migrate:X` (e.g. `migrate:status`)
  // or as the bare `X` for convenience.
  const PROD_ALLOWLIST = new Set([
    'migrate:deploy',
    'migrate:status',
    'migrate:resolve',
    'deploy',
    'status',
    'resolve',
  ]);
  if (!PROD_ALLOWLIST.has(normalized)) {
    console.error(
      `[migrate] BLOCKED: '${normalized}' is not on the production allowlist. ` +
        'Allowed: deploy | status | resolve. ' +
        'If this is intentional, run with APP_ENV=develop on a dev DB instead.'
    );
    process.exit(3);
  }
}

// ---- 4. Run the real prisma command --------------------------------------
const prismaBin = resolve(process.cwd(), 'node_modules/.bin/prisma');
if (!existsSync(prismaBin)) {
  console.error(
    `[migrate] Prisma CLI not found at ${prismaBin}. ` +
      'Run `npm install` from the repo root first.'
  );
  process.exit(2);
}

console.log(`[migrate] running: prisma ${argv.join(' ')}`);
const result = spawnSync(prismaBin, argv, {
  stdio: 'inherit',
  env: { ...process.env, DATABASE_URL: databaseUrl },
});

process.exit(result.status ?? 1);
