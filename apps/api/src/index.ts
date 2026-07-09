import { buildApp } from './app.js'
import { APP_ENV, logEnvOnStartup, PORT as ENV_PORT } from './config.js'

const HOST = process.env.HOST ?? '0.0.0.0'
const PORT = ENV_PORT

async function main(): Promise<void> {
  // Log the env BEFORE the app starts so it shows up even if DB connection fails.
  logEnvOnStartup()

  const app = await buildApp()

  try {
    await app.listen({ port: PORT, host: HOST })
    app.log.info(`[APP_ENV=${APP_ENV}] API listening on http://${HOST}:${PORT}`)
  } catch (error) {
    app.log.error(error)
    process.exit(1)
  }
}

main()
