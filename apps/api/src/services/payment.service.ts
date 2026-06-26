import { prisma } from '../db/prisma.js';
import { PaymentMethod } from '@barbaros/shared';

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
      // Fetch account + orderItems → compute total
      const account = await tx.account.findUnique({
        where: { id: accountId },
        include: { orderItems: true }
      });

      if (!account) throw new Error('Account not found');
      if (account.status !== 'OPEN') throw new Error('Account is not open');

      const total = account.orderItems.reduce(
        (sum: number, item: any) => sum + Number(item.unitPrice) * item.quantity,
        0
      );

      // SUM(payments.amount) → existing paid
      const paidResult = await tx.payment.aggregate({
        where: { accountId },
        _sum: { amount: true }
      });

      const existingPaid = Number(paidResult._sum.amount || 0);
      const pendingAmount = total - existingPaid;

      // Validate: amount <= pending
      if (amount > pendingAmount) {
        throw new Error('Amount exceeds pending amount');
      }

      // Insert payment
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

    const total = account.orderItems.reduce(
      (sum: number, item: any) => sum + Number(item.unitPrice) * item.quantity,
      0
    );

    const paidResult = await prisma.payment.aggregate({
      where: { accountId },
      _sum: { amount: true }
    });

    const existingPaid = Number(paidResult._sum.amount || 0);
    return total - existingPaid;
  }
}
