/**
 * Format number as Colombian peso (no decimals, period as thousands separator)
 * e.g. 1234567 → "$1.234.567"
 */
export function formatCOP(value: number): string {
  return `$${Math.round(value).toLocaleString('es-CO')}`;
}
