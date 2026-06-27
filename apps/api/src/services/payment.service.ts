import { prisma } from '../db/prisma.js';
import { PaymentMethod, calculateAccountTotal, DiscountType } from '@barbaros/shared';

export class PaymentService {
  static async createPayment(
    accountId: string,
    amount: number,
    method: PaymentMethod,
    proofUrl?: string
  ) {
    if (amount <= 0) {
      throw new Error('Amount must be greater than zero');
    }

    if (!Object.values(PaymentMethod).includes(method)) {
      throw new Error('Invalid payment method');
    }

    return prisma.$transaction(async (tx: any) => {
      const account = await tx.account.findUnique({
        where: { id: accountId },
        include: { orderItems: true }
      });

      if (!account) throw new Error('Account not found');
      if (account.status !== 'OPEN') throw new Error('Account is not open');

      const result = calculateAccountTotal({
        items: account.orderItems.map((item: any) => ({
          quantity: item.quantity,
          unitPrice: Number(item.unitPrice),
          discountType: item.discountType as DiscountType,
          discountValue: Number(item.discountValue),
        })),
        accountDiscountType: account.discountType as DiscountType,
        accountDiscountValue: Number(account.discountValue),
      });

      const paidResult = await tx.payment.aggregate({
        where: { accountId },
        _sum: { amount: true }
      });

      const existingPaid = Number(paidResult._sum.amount || 0);
      const pendingAmount = result.total - existingPaid;

      if (amount > pendingAmount) {
        throw new Error('Amount exceeds pending amount');
      }

      const payment = await tx.payment.create({
        data: {
          accountId,
          amount,
          method,
          proofUrl: proofUrl || null
        }
      });

      return { payment, pendingAmount: pendingAmount - amount };
    }, {
      isolationLevel: 'Serializable'
    });
  }

  static async listPayments(accountId: string) {
    return prisma.payment.findMany({
      where: { accountId },
      orderBy: { createdAt: 'desc' }
    });
  }

  static async getPendingAmount(accountId: string) {
    const account = await prisma.account.findUnique({
      where: { id: accountId },
      include: { orderItems: true }
    });

    if (!account) throw new Error('Account not found');

    const result = calculateAccountTotal({
      items: account.orderItems.map((item: any) => ({
        quantity: item.quantity,
        unitPrice: Number(item.unitPrice),
        discountType: item.discountType as DiscountType,
        discountValue: Number(item.discountValue),
      })),
      accountDiscountType: account.discountType as DiscountType,
      accountDiscountValue: Number(account.discountValue),
    });

    const paidResult = await prisma.payment.aggregate({
      where: { accountId },
      _sum: { amount: true }
    });

    const existingPaid = Number(paidResult._sum.amount || 0);
    return result.total - existingPaid;
  }
}
