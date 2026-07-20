import API_URL from '../utils/apiUrl.js'
import type { IAccount } from '@barbaros/shared'

export type AccountActionResult =
  | { ok: true; account: IAccount }
  | { ok: false; status: number; message: string }

export async function voidAccount(accountId: string, pin: string): Promise<AccountActionResult> {
  const res = await fetch(`${API_URL}/accounts/${accountId}/void`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pin }),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: 'Error' }))
    return { ok: false, status: res.status, message: data.error || 'Error' }
  }
  const account = (await res.json()) as IAccount
  return { ok: true, account }
}

export async function reopenAccount(accountId: string, pin: string): Promise<AccountActionResult> {
  const res = await fetch(`${API_URL}/accounts/${accountId}/reopen`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pin }),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: 'Error' }))
    return { ok: false, status: res.status, message: data.error || 'Error' }
  }
  const account = (await res.json()) as IAccount
  return { ok: true, account }
}

export async function saveAccountPosition(
  accountId: string,
  data: { posX?: number; posY?: number },
): Promise<void> {
  await fetch(`${API_URL}/accounts/${accountId}/position`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
}

export async function saveAccountCardSize(accountId: string, cardSize: string): Promise<void> {
  await fetch(`${API_URL}/accounts/${accountId}/card-size`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cardSize }),
  })
}

export async function saveAccountCardDimensions(
  accountId: string,
  cardWidth: number,
  cardHeight: number,
): Promise<void> {
  await fetch(`${API_URL}/accounts/${accountId}/card-dimensions`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cardWidth, cardHeight }),
  })
}
