/**
 * Centralized environment loader for the API.
 *
 * Loads the correct `.env.*` file based on `APP_ENV` BEFORE Prisma reads
 * `DATABASE_URL`. The loaded file is `.env.develop` or `.env.production`,
 * both of which ARE committed to git (they contain only non-secret local
 * config — the DB runs in a sibling Docker container on the same machine).
 *
 * `.env` (untracked) can still override values locally for development.
 *
 * Hard guard: if `APP_ENV` is missing or invalid, we fail fast at startup
 * rather than silently defaulting to a DB we did not intend to use.
 */
import { config as loadEnv } from 'dotenv';
import { resolve } from 'path';
import { existsSync } from 'fs';

export type AppEnv = 'develop' | 'production';

const VALID_ENVS: readonly AppEnv[] = ['develop', 'production'] as const;

function resolveEnv(): AppEnv {
  const raw = process.env.APP_ENV;
  if (!raw) {
    throw new Error(
      'APP_ENV is not set. Must be one of: develop | production. ' +
        'Set it in apps/api/.env.develop, apps/api/.env.production, or your local .env.'
    );
  }
  if (!VALID_ENVS.includes(raw as AppEnv)) {
    throw new Error(
      `APP_ENV="${raw}" is invalid. Must be one of: develop | production.`
    );
  }
  return raw as AppEnv;
}

function loadEnvFile(): { env: AppEnv; file: string } {
  const env = resolveEnv();
  const envDir = resolve(__dirname, '..');
  const targetFile = resolve(envDir, `.env.${env}`);

  if (!existsSync(targetFile)) {
    throw new Error(
      `Expected env file not found: ${targetFile}. ` +
        `Create it or switch APP_ENV to a valid value.`
    );
  }

  // Load the per-env file. `override: true` so an existing process env var
  // (e.g. set by the operator at launch) wins over the file. This lets
  // production deploys inject secrets without editing the file.
  loadEnv({ path: targetFile, override: false });

  // Also load a local untracked .env last (lower priority than the per-env file)
  // so devs can override the per-env defaults without touching the committed file.
  const localFile = resolve(envDir, '.env');
  if (existsSync(localFile)) {
    loadEnv({ path: localFile, override: false });
  }

  return { env, file: targetFile };
}

const loaded = loadEnvFile();
export const APP_ENV: AppEnv = loaded.env;

export const DATABASE_URL: string = (() => {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      `DATABASE_URL is not set after loading ${loaded.file}. ` +
        `The .env file must define DATABASE_URL.`
    );
  }
  return url;
})();

export const PORT: number = (() => {
  const raw = process.env.PORT;
  if (!raw) return 3000;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error(`PORT="${raw}" is not a valid positive integer.`);
  }
  return n;
})();

/** Redact a password from a postgres URL for safe logging. */
export function redactDbUrl(url: string): string {
  return url.replace(/:[^:@/]+@/, ':***@');
}

/** Log env at startup so the operator can verify the system is talking to the right DB. */
export function logEnvOnStartup(): void {
  // eslint-disable-next-line no-console
  console.log(
    `[APP_ENV=${APP_ENV}] connecting to ${redactDbUrl(DATABASE_URL)} (loaded ${loaded.file})`
  );
}
