import cors from '@fastify/cors'
import websocket from '@fastify/websocket'
import Fastify from 'fastify'
import path from 'path'
import { fileURLToPath } from 'url'
import fastifyStatic from '@fastify/static'
import multipart from '@fastify/multipart'

import shiftRoutes from './routes/shifts/index.js'
import accountRoutes from './routes/accounts/index.js'
import categoryRoutes from './routes/categories/index.js'
import productRoutes from './routes/products/index.js'
import reportRoutes from './routes/reports.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export async function buildApp() {
  const app = Fastify({
    logger: true,
  })

  await app.register(cors, {
    origin: true,
    credentials: true,
  })

  await app.register(websocket)

  // Register multipart for file uploads
  await app.register(multipart)

  // Static file serving for uploads
  await app.register(fastifyStatic, {
    root: path.join(__dirname, '../uploads'),
    prefix: '/uploads/',
    decorateReply: false,
  })

  app.get('/health', async () => ({ status: 'ok' }))

  await app.register(shiftRoutes, { prefix: '/shifts' })
  await app.register(accountRoutes, { prefix: '/accounts' })
  await app.register(categoryRoutes, { prefix: '/categories' })
  await app.register(productRoutes, { prefix: '/products' })
  await app.register(reportRoutes, { prefix: '/reports' })

  // Socket connection handler
  app.register(async function (fastify) {
    fastify.get('/ws', { websocket: true }, (socket, _req) => {
      socket.on('message', (_message: any) => {
        // Just acknowledging connection
      })
    })
  })

  return app
}
