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
import { config as loadEnv } from 'dotenv'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { existsSync } from 'fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

export type AppEnv = 'develop' | 'production'

const VALID_ENVS: readonly AppEnv[] = ['develop', 'production'] as const

function resolveEnv(): AppEnv {
  const raw = process.env.APP_ENV
  if (!raw) {
    throw new Error(
      'APP_ENV is not set. Must be one of: develop | production. ' +
        'Set it in apps/api/.env.develop, apps/api/.env.production, or your local .env.',
    )
  }
  if (!VALID_ENVS.includes(raw as AppEnv)) {
    throw new Error(`APP_ENV="${raw}" is invalid. Must be one of: develop | production.`)
  }
  return raw as AppEnv
}

function loadEnvFile(): { env: AppEnv; file: string } {
  const env = resolveEnv()
  const envDir = resolve(__dirname, '..')
  const targetFile = resolve(envDir, `.env.${env}`)

  if (!existsSync(targetFile)) {
    throw new Error(
      `Expected env file not found: ${targetFile}. ` +
        `Create it or switch APP_ENV to a valid value.`,
    )
  }

  // Load the per-env file with `override: true` — the per-env file is
  // the source of truth for which DB/port/host to use in each environment.
  // We force-override so a stale DATABASE_URL in the operator's shell
  // (e.g. from a previous session) cannot redirect the API to the wrong
  // database. Secrets should be injected at the container/host level
  // (e.g. k8s secrets, docker --env-file), not by pre-seeding the shell.
  loadEnv({ path: targetFile, override: true })

  // Then load a local untracked .env (lower priority than the per-env file)
  // so devs can override individual values without touching the committed
  // per-env file. override: false so the per-env file wins.
  const localFile = resolve(envDir, '.env')
  if (existsSync(localFile)) {
    loadEnv({ path: localFile, override: false })
  }

  return { env, file: targetFile }
}

const loaded = loadEnvFile()
export const APP_ENV: AppEnv = loaded.env

export const DATABASE_URL: string = (() => {
  const url = process.env.DATABASE_URL
  if (!url) {
    throw new Error(
      `DATABASE_URL is not set after loading ${loaded.file}. ` +
        `The .env file must define DATABASE_URL.`,
    )
  }
  return url
})()

export const PORT: number = (() => {
  const raw = process.env.PORT
  if (!raw) return 3000
  const n = Number(raw)
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error(`PORT="${raw}" is not a valid positive integer.`)
  }
  return n
})()

export const ADMIN_PIN_HASH: string = (() => {
  const hash = process.env.ADMIN_PIN_HASH
  if (!hash) {
    throw new Error(
      'ADMIN_PIN_HASH is not set. Set it in apps/api/.env.develop, apps/api/.env.production, ' +
        'or your local .env. Generate a bcrypt hash of the admin PIN and store it here.',
    )
  }
  return hash
})()

/** Redact a password from a postgres URL for safe logging. */
export function redactDbUrl(url: string): string {
  return url.replace(/:[^:@/]+@/, ':***@')
}

/** Log env at startup so the operator can verify the system is talking to the right DB. */
export function logEnvOnStartup(): void {
  console.log(
    `[APP_ENV=${APP_ENV}] connecting to ${redactDbUrl(DATABASE_URL)} (loaded ${loaded.file})`,
  )
}
