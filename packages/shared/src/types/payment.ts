export enum PaymentMethod {
  CASH = 'CASH',
  TRANSFER = 'TRANSFER',
  CARD = 'CARD',
}

export interface Payment {
  id: string
  accountId: string
  amount: number
  method: PaymentMethod
  proofUrl?: string
  createdAt: Date
}

export interface PaymentCreateRequest {
  amount: number
  method: PaymentMethod
  proofUrl?: string
}

export interface PaymentCreateResponse {
  payment: Payment
  pendingAmount: number
}
