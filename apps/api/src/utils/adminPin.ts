import bcrypt from 'bcryptjs'
import { ADMIN_PIN_HASH } from '../config.js'

interface Attempt {
  count: number
  resetAt: number
}

const attempts = new Map<string, Attempt>()

const MAX_ATTEMPTS = 5
const WINDOW_MS = 5 * 60 * 1000

function getClientIp(request: any): string {
  const forwarded = request.headers?.['x-forwarded-for']
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0].trim()
  }
  return request.ip || 'unknown'
}

function isRateLimited(ip: string): boolean {
  const now = Date.now()
  const record = attempts.get(ip)

  if (!record) {
    return false
  }

  if (now >= record.resetAt) {
    attempts.delete(ip)
    return false
  }

  return record.count >= MAX_ATTEMPTS
}

function recordFailure(ip: string): void {
  const now = Date.now()
  const record = attempts.get(ip)

  if (!record || now >= record.resetAt) {
    attempts.set(ip, { count: 1, resetAt: now + WINDOW_MS })
    return
  }

  record.count += 1
}

export async function verifyAdminPin(pin: string, request: any): Promise<boolean> {
  if (!pin || typeof pin !== 'string') {
    return false
  }

  const ip = getClientIp(request)

  if (isRateLimited(ip)) {
    return false
  }

  const ok = await bcrypt.compare(pin, ADMIN_PIN_HASH)

  if (!ok) {
    recordFailure(ip)
  }

  return ok
}

export function getRateLimitWindowMs(): number {
  return WINDOW_MS
}
