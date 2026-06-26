export interface ShiftReport {
  shiftId: string
  openedAt: Date
  closedAt?: Date
  totalSales: number
  totalPaid: number
  pendingAmount: number
  paymentsByMethod: Record<string, number>
}
