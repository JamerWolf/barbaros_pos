import { prisma } from '../db/prisma.js';

export class AccountService {
  static async getActiveShift() {
    return prisma.shift.findFirst({
      where: { status: 'OPEN' },
      orderBy: { createdAt: 'desc' }
    });
  }

  static async openShift() {
    const active = await this.getActiveShift();
    if (active) throw new Error('There is already an active shift');
    return prisma.shift.create({ data: { status: 'OPEN' } });
  }

  static async closeShift() {
    const active = await this.getActiveShift();
    if (!active) throw new Error('No active shift to close');
    return prisma.shift.update({
      where: { id: active.id },
      data: { status: 'CLOSED' }
    });
  }

  static async createAccount(name: string) {
    return prisma.$transaction(async (tx: any) => {
      const shift = await tx.shift.findFirst({
        where: { status: 'OPEN' },
        orderBy: { createdAt: 'desc' }
      });

      if (!shift) {
        throw new Error('No active shift available');
      }

      const maxAccount = await tx.account.findFirst({
        where: { shiftId: shift.id },
        orderBy: { number: 'desc' }
      });

      const nextNumber = maxAccount ? maxAccount.number + 1 : 1;

      return tx.account.create({
        data: {
          shiftId: shift.id,
          name,
          number: nextNumber,
          status: 'OPEN'
        }
      });
    }, {
      isolationLevel: 'Serializable'
    });
  }

  static async getAccountWithItems(id: string) {
    const account = await prisma.account.findUnique({
      where: { id },
      include: { orderItems: { include: { product: true } }, payments: true }
    });
    if (!account) return null;
    const total = account.orderItems.reduce((sum: number, item: any) => sum + Number(item.unitPrice) * item.quantity, 0);
    const paidSum = account.payments.reduce((sum: number, p: any) => sum + Number(p.amount), 0);
    const pendingAmount = total - paidSum;
    return { ...account, total, pendingAmount, payments: account.payments };
  }

  static async closeAccount(id: string) {
    const account = await prisma.account.findUnique({
      where: { id },
      include: { orderItems: true, payments: true }
    });
    if (!account) throw new Error('Account not found');
    if (account.status === 'CLOSED') throw new Error('Account is already closed');

    const total = account.orderItems.reduce((sum: number, item: any) => sum + Number(item.unitPrice) * item.quantity, 0);
    const paidSum = account.payments.reduce((sum: number, p: any) => sum + Number(p.amount), 0);
    const pendingAmount = total - paidSum;

    if (pendingAmount > 0) {
      throw new Error('Cannot close account with pending payments');
    }

    if (total === 0) {
      await prisma.account.delete({ where: { id } });
      return { deleted: true, id };
    }

    const updated = await prisma.account.update({
      where: { id },
      data: { status: 'CLOSED' }
    });
    return { deleted: false, account: updated };
  }

  static async listItems(accountId: string) {
    const items = await prisma.orderItem.findMany({
      where: { accountId },
      include: { product: true }
    });
    const total = items.reduce((sum: number, item: any) => sum + Number(item.unitPrice) * item.quantity, 0);
    return { items, total };
  }

  static async addItem(accountId: string, productId: string, quantity?: number) {
    const account = await prisma.account.findUnique({ where: { id: accountId } });
    if (!account) throw new Error('Account not found');
    if (account.status !== 'OPEN') throw new Error('Account is not open');

    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) throw new Error('Product not found');
    if (!product.active) throw new Error('Product is inactive');

    const existing = await prisma.orderItem.findUnique({
      where: { accountId_productId: { accountId, productId } }
    });

    if (existing) {
      return prisma.orderItem.update({
        where: { id: existing.id },
        data: { quantity: existing.quantity + (quantity || 1) },
        include: { product: true }
      });
    }

    return prisma.orderItem.create({
      data: {
        accountId,
        productId,
        quantity: quantity || 1,
        unitPrice: product.price,
      },
      include: { product: true }
    });
  }

  static async updateItemQuantity(accountId: string, itemId: string, quantity: number) {
    const item = await prisma.orderItem.findFirst({ where: { id: itemId, accountId } });
    if (!item) throw new Error('Item not found');

    if (quantity < 1) {
      await prisma.orderItem.delete({ where: { id: itemId } });
      return { deleted: true };
    }

    return prisma.orderItem.update({
      where: { id: itemId },
      data: { quantity },
      include: { product: true }
    });
  }

  static async removeItem(accountId: string, itemId: string) {
    const item = await prisma.orderItem.findFirst({ where: { id: itemId, accountId } });
    if (!item) throw new Error('Item not found');
    await prisma.orderItem.delete({ where: { id: itemId } });
    return { deleted: true };
  }
}
