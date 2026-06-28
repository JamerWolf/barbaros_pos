import { FastifyPluginAsync } from 'fastify';
import { AccountService } from '../../services/account.service.js';
import { PaymentService } from '../../services/payment.service.js';
import { prisma } from '../../db/prisma.js';
import { calculateAccountTotal, DiscountType } from '@barbaros/shared';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function emitSocketEvent(fastify: any, event: string, payload: any) {
  if (fastify.websocketServer) {
    fastify.websocketServer.clients.forEach((client: any) => {
      if (client.readyState === 1) {
        client.send(JSON.stringify({ event, data: payload }));
      }
    });
  }
}

async function broadcastAccountUpdated(fastify: any, accountId: string) {
  const account = await AccountService.getAccountWithItems(accountId);
  if (account) {
    emitSocketEvent(fastify, 'account:updated', account);
  }
  return account;
}

const accountRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post('/', async (request, reply) => {
    const { name } = request.body as { name?: string };

    try {
      const account = await AccountService.createAccount(name || '');
      emitSocketEvent(fastify, 'account:created', account);
      return reply.code(201).send(account);
    } catch (err: any) {
      return reply.code(400).send({ error: err.message });
    }
  });

  fastify.get('/', async (request, reply) => {
    const activeShift = await AccountService.getActiveShift();
    if (!activeShift) return reply.code(200).send([]);

    const accounts = await prisma.account.findMany({
      where: { shiftId: activeShift.id },
      include: { orderItems: true, payments: true }
    });

    const accountsWithTotal = accounts.map((acc) => {
      const result = calculateAccountTotal({
        items: acc.orderItems.map((item) => ({
          quantity: item.quantity,
          unitPrice: Number(item.unitPrice),
          discountType: item.discountType as DiscountType,
          discountValue: Number(item.discountValue),
        })),
        accountDiscountType: acc.discountType as DiscountType,
        accountDiscountValue: Number(acc.discountValue),
      });
      const paidSum = acc.payments.reduce((sum, p) => sum + Number(p.amount), 0);
      const pendingAmount = result.total - paidSum;
      return { ...acc, total: result.total, pendingAmount, payments: acc.payments };
    });

    return reply.code(200).send(accountsWithTotal);
  });

  // Get all open accounts from ALL shifts (for list mode)
  fastify.get('/all-open', async (request, reply) => {
    const accounts = await prisma.account.findMany({
      where: { status: 'OPEN' },
      include: { orderItems: true, payments: true }
    });

    const accountsWithTotal = accounts.map((acc) => {
      const result = calculateAccountTotal({
        items: acc.orderItems.map((item) => ({
          quantity: item.quantity,
          unitPrice: Number(item.unitPrice),
          discountType: item.discountType as DiscountType,
          discountValue: Number(item.discountValue),
        })),
        accountDiscountType: acc.discountType as DiscountType,
        accountDiscountValue: Number(acc.discountValue),
      });
      const paidSum = acc.payments.reduce((sum, p) => sum + Number(p.amount), 0);
      const pendingAmount = result.total - paidSum;
      return { ...acc, total: result.total, pendingAmount, payments: acc.payments };
    });

    return reply.code(200).send(accountsWithTotal);
  });

  fastify.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const account = await AccountService.getAccountWithItems(id);
    if (!account) return reply.code(404).send({ error: 'Account not found' });
    return reply.code(200).send(account);
  });

  fastify.patch('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { name } = request.body as { name?: string };

    try {
      const updated = await prisma.account.update({
        where: { id },
        data: { name: name ?? '' },
      });
      emitSocketEvent(fastify, 'account:updated', updated);
      return reply.code(200).send(updated);
    } catch (err: any) {
      return reply.code(400).send({ error: err.message });
    }
  });

  fastify.put('/:id/close', async (request, reply) => {
    const { id } = request.params as { id: string };

    try {
      const result = await AccountService.closeAccount(id);

      if (result.deleted) {
        emitSocketEvent(fastify, 'account:deleted', id);
        return reply.code(204).send();
      } else {
        emitSocketEvent(fastify, 'account:updated', result.account);
        return reply.code(200).send(result.account);
      }
    } catch (err: any) {
      return reply.code(400).send({ error: err.message });
    }
  });

  fastify.post('/:id/payments', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { amount, method, proofUrl } = request.body as {
      amount?: number;
      method?: string;
      proofUrl?: string;
    };

    if (!amount || amount <= 0) {
      return reply.code(400).send({ error: 'Amount must be greater than zero' });
    }

    if (!method || !['CASH', 'TRANSFER', 'CARD'].includes(method)) {
      return reply.code(400).send({ error: 'Invalid payment method' });
    }

    try {
      const result = await PaymentService.createPayment(
        id,
        amount,
        method as any,
        proofUrl
      );

      // Get updated account for broadcast
      const account = await AccountService.getAccountWithItems(id);

      emitSocketEvent(fastify, 'payment:created', {
        payment: result.payment,
        pendingAmount: result.pendingAmount,
        account
      });

      return reply.code(201).send({
        payment: result.payment,
        pendingAmount: result.pendingAmount
      });
    } catch (err: any) {
      const status = err.message.includes('not found') ? 404 : 400;
      return reply.code(status).send({ error: err.message });
    }
  });

  fastify.get('/:id/payments', async (request, reply) => {
    const { id } = request.params as { id: string };

    try {
      const payments = await PaymentService.listPayments(id);
      return reply.code(200).send(payments);
    } catch (err: any) {
      return reply.code(400).send({ error: err.message });
    }
  });

  fastify.post('/:id/payments/upload', async (request, reply) => {
    const { id } = request.params as { id: string };

    try {
      const parts = request.parts();
      let amount = 0;
      let method = '';
      let proofUrl: string | undefined;

      for await (const part of parts) {
        if (part.type === 'file') {
          const ext = path.extname(part.filename).toLowerCase();
          if (!['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) {
            return reply.code(400).send({ error: 'Only JPG, PNG, or WebP images accepted' });
          }

          const uploadsDir = path.join(__dirname, '../../uploads');
          await fs.mkdir(uploadsDir, { recursive: true });

          const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
          const filepath = path.join(uploadsDir, filename);

          const buffer = await part.toBuffer();
          if (buffer.length > 5 * 1024 * 1024) {
            return reply.code(400).send({ error: 'File size must be under 5MB' });
          }
          await fs.writeFile(filepath, buffer);
          proofUrl = `uploads/payments/${filename}`;
        } else {
          const field = part as any;
          if (field.fieldname === 'amount') amount = Number(field.value);
          if (field.fieldname === 'method') method = String(field.value);
        }
      }

      if (!amount || amount <= 0) {
        return reply.code(400).send({ error: 'Amount must be greater than zero' });
      }

      if (!method || !['CASH', 'TRANSFER', 'CARD'].includes(method)) {
        return reply.code(400).send({ error: 'Invalid payment method' });
      }

      const result = await PaymentService.createPayment(id, amount, method as any, proofUrl);
      const account = await AccountService.getAccountWithItems(id);

      emitSocketEvent(fastify, 'payment:created', {
        payment: result.payment,
        pendingAmount: result.pendingAmount,
        account
      });

      return reply.code(201).send({
        payment: result.payment,
        pendingAmount: result.pendingAmount
      });
    } catch (err: any) {
      return reply.code(400).send({ error: err.message });
    }
  });

  fastify.get('/:id/items', async (request, reply) => {
    const { id } = request.params as { id: string };

    try {
      const result = await AccountService.listItems(id);
      return reply.code(200).send(result);
    } catch (err: any) {
      return reply.code(400).send({ error: err.message });
    }
  });

  fastify.post('/:id/items', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { productId, quantity } = request.body as { productId?: string; quantity?: number };

    if (!productId) return reply.code(400).send({ error: 'productId is required' });

    try {
      await AccountService.addItem(id, productId, quantity);
      const updated = await broadcastAccountUpdated(fastify, id);
      return reply.code(201).send(updated);
    } catch (err: any) {
      const status = err.message.includes('not found') ? 404 : 400;
      return reply.code(status).send({ error: err.message });
    }
  });

  fastify.patch('/:id/items/:itemId', async (request, reply) => {
    const { id, itemId } = request.params as { id: string; itemId: string };
    const { quantity } = request.body as { quantity?: number };

    if (quantity === undefined) return reply.code(400).send({ error: 'quantity is required' });

    try {
      await AccountService.updateItemQuantity(id, itemId, quantity);
      const updated = await broadcastAccountUpdated(fastify, id);
      return reply.code(200).send(updated);
    } catch (err: any) {
      return reply.code(400).send({ error: err.message });
    }
  });

  fastify.delete('/:id/items/:itemId', async (request, reply) => {
    const { id, itemId } = request.params as { id: string; itemId: string };

    try {
      await AccountService.removeItem(id, itemId);
      const updated = await broadcastAccountUpdated(fastify, id);
      return reply.code(200).send(updated);
    } catch (err: any) {
      return reply.code(400).send({ error: err.message });
    }
  });

  fastify.patch('/:id/discount', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { discountType, discountValue } = request.body as {
      discountType?: string;
      discountValue?: number;
    };

    if (!discountType || !['NONE', 'FIXED', 'PERCENT'].includes(discountType)) {
      return reply.code(400).send({ error: 'Invalid discount type' });
    }

    if (discountValue === undefined || discountValue < 0) {
      return reply.code(400).send({ error: 'Value out of range' });
    }

    if (discountType === 'PERCENT' && discountValue > 100) {
      return reply.code(400).send({ error: 'Value out of range' });
    }

    try {
      const account = await AccountService.setAccountDiscount(
        id,
        discountType as DiscountType,
        discountValue
      );

      if (!account) return reply.code(404).send({ error: 'Account not found' });

      const paidSum = account.payments?.reduce((sum: number, p: any) => sum + Number(p.amount), 0) ?? 0;
      const pendingAmount = account.total! - paidSum;

      emitSocketEvent(fastify, 'discount:updated', {
        accountId: id,
        total: account.total!,
        pendingAmount,
        account,
      });

      return reply.code(200).send({ account, total: account.total, pendingAmount });
    } catch (err: any) {
      return reply.code(400).send({ error: err.message });
    }
  });

  fastify.patch('/:id/items/:itemId/discount', async (request, reply) => {
    const { id, itemId } = request.params as { id: string; itemId: string };
    const { discountType, discountValue } = request.body as {
      discountType?: string;
      discountValue?: number;
    };

    if (!discountType || !['NONE', 'FIXED', 'PERCENT'].includes(discountType)) {
      return reply.code(400).send({ error: 'Invalid discount type' });
    }

    if (discountValue === undefined || discountValue < 0) {
      return reply.code(400).send({ error: 'Value out of range' });
    }

    if (discountType === 'PERCENT' && discountValue > 100) {
      return reply.code(400).send({ error: 'Value out of range' });
    }

    try {
      const account = await AccountService.setItemDiscount(
        id,
        itemId,
        discountType as DiscountType,
        discountValue
      );

      if (!account) return reply.code(404).send({ error: 'Account not found' });

      const paidSum = account.payments?.reduce((sum: number, p: any) => sum + Number(p.amount), 0) ?? 0;
      const pendingAmount = account.total! - paidSum;

      emitSocketEvent(fastify, 'discount:updated', {
        accountId: id,
        total: account.total!,
        pendingAmount,
        account,
      });

      return reply.code(200).send({ account, total: account.total, pendingAmount });
    } catch (err: any) {
      const status = err.message.includes('not found') ? 404 : 400;
      return reply.code(status).send({ error: err.message });
    }
  });
};

export default accountRoutes;
