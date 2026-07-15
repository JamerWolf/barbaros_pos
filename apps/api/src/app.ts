import cors from '@fastify/cors'
import websocket from '@fastify/websocket'
import Fastify from 'fastify'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import fastifyStatic from '@fastify/static'
import multipart from '@fastify/multipart'

import shiftRoutes from './routes/shifts/index.js'
import accountRoutes from './routes/accounts/index.js'
import categoryRoutes from './routes/categories/index.js'
import productRoutes from './routes/products/index.js'
import reportRoutes from './routes/reports.js'
import shapeRoutes from './routes/shapes/index.js'
import { APP_ENV } from './config.js'

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

  // Register multipart for file uploads (5MB per file, 50MB total)
  await app.register(multipart, {
    limits: {
      fileSize: 5 * 1024 * 1024,   // 5MB per file
      files: 20,                     // max 20 files (CSV + photos)
      fieldSize: 1 * 1024 * 1024,   // 1MB per field
    },
  })

  // Static file serving for uploads
  await app.register(fastifyStatic, {
    root: path.join(__dirname, '../uploads'),
    prefix: '/uploads/',
    decorateReply: false,
  })

  // Static file serving for web build (production only)
  if (APP_ENV === 'production') {
    const webDistPath = path.join(__dirname, '../../web/dist')
    if (fs.existsSync(webDistPath)) {
      await app.register(fastifyStatic, {
        root: webDistPath,
        prefix: '/',
        decorateReply: false,
      })
    }
  }

  app.get('/health', async () => ({ status: 'ok' }))

  await app.register(shiftRoutes, { prefix: '/shifts' })
  await app.register(accountRoutes, { prefix: '/accounts' })
  await app.register(categoryRoutes, { prefix: '/categories' })
  await app.register(productRoutes, { prefix: '/products' })
  await app.register(reportRoutes, { prefix: '/reports' })
  await app.register(shapeRoutes, { prefix: '/shapes' })

  // Socket connection handler
  app.register(async function (fastify) {
    fastify.get('/ws', { websocket: true }, (socket, _req) => {
      socket.on('message', (_message: any) => {
        // Just acknowledging connection
      })
    })
  })

  // SPA fallback: serve index.html for non-API GET requests
  // This handles direct access to the API server (e.g. via Cloudflare Tunnel)
  const indexPath = path.join(__dirname, '../../web/dist/index.html')
  app.setNotFoundHandler(async (request, reply) => {
    if (request.method === 'GET' && request.headers.accept?.includes('text/html')) {
      try {
        const html = fs.readFileSync(indexPath, 'utf-8')
        return reply.type('text/html').send(html)
      } catch {
        // dist not built yet, just return 404
      }
    }
    return reply.code(404).send({ message: 'Not Found' })
  })

  return app
}
