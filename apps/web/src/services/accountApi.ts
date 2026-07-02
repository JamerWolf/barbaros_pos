const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export async function saveAccountPosition(
  accountId: string,
  data: { posX?: number; posY?: number; cardSize?: string }
): Promise<void> {
  await fetch(`${API_URL}/accounts/${accountId}/position`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}
