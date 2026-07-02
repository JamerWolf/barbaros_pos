import API_URL from '../utils/apiUrl.js';

export async function saveAccountPosition(
  accountId: string,
  data: { posX?: number; posY?: number }
): Promise<void> {
  await fetch(`${API_URL}/accounts/${accountId}/position`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export async function saveAccountCardSize(
  accountId: string,
  cardSize: string
): Promise<void> {
  await fetch(`${API_URL}/accounts/${accountId}/card-size`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cardSize }),
  });
}
