import { prisma } from '../db/prisma.js';
import { calculateAccountTotal, DiscountType } from '@barbaros/shared';
import type { ShiftListItem, ShiftSummary, ShiftAccountSummary, PaymentMethodType } from '@barbaros/shared';
import ExcelJS from 'exceljs';

function formatCOP(value: number): string {
  return '$' + Math.round(value).toLocaleString('es-CO');
}

export class ReportService {
  static async listShifts(from?: string, to?: string): Promise<ShiftListItem[]> {
    const where: any = {};
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = new Date(from);
      if (to) {
        where.createdAt.lt = new Date(to);
      }
    }

    const shifts = await prisma.shift.findMany({
      where,
      include: {
        accounts: {
          include: {
            orderItems: true,
            payments: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return shifts.map((shift) => {
      let totalSales = 0;
      let totalPaid = 0;
      const paymentsByMethod: Record<string, number> = { CASH: 0, TRANSFER: 0, CARD: 0 };

      for (const account of shift.accounts) {
        const orderItems = (account as any).orderItems ?? [];
        const payments = (account as any).payments ?? [];

        const result = calculateAccountTotal({
          items: orderItems.map((item: any) => ({
            quantity: item.quantity,
            unitPrice: Number(item.unitPrice),
            discountType: item.discountType as DiscountType,
            discountValue: Number(item.discountValue),
          })),
          accountDiscountType: (account.discountType as DiscountType) || DiscountType.NONE,
          accountDiscountValue: Number(account.discountValue ?? 0),
        });

        totalSales += result.total;

        for (const p of payments) {
          const amount = Number(p.amount);
          totalPaid += amount;
          const method = p.method as string;
          if (method in paymentsByMethod) {
            paymentsByMethod[method] += amount;
          }
        }
      }

      return {
        id: shift.id,
        status: shift.status as 'OPEN' | 'CLOSED',
        openedAt: shift.createdAt.toISOString(),
        closedAt: shift.updatedAt.toISOString(),
        accountsCount: shift.accounts.length,
        totalSales,
        totalPaid,
        pendingAmount: totalSales - totalPaid,
        paymentsByMethod: paymentsByMethod as Record<PaymentMethodType, number>,
      };
    });
  }

  static async getShiftSummary(shiftId: string): Promise<ShiftSummary | null> {
    const shift = await prisma.shift.findUnique({
      where: { id: shiftId },
      include: {
        accounts: {
          include: {
            orderItems: true,
            payments: true,
          },
        },
      },
    });

    if (!shift) return null;

    let totalSales = 0;
    let totalPaid = 0;
    const accounts: ShiftAccountSummary[] = [];
    const paymentsByMethod: Record<PaymentMethodType, number> = {
      CASH: 0,
      TRANSFER: 0,
      CARD: 0,
    };

    for (const account of shift.accounts) {
      const result = calculateAccountTotal({
        items: account.orderItems.map((item: any) => ({
          quantity: item.quantity,
          unitPrice: Number(item.unitPrice),
          discountType: item.discountType as DiscountType,
          discountValue: Number(item.discountValue),
        })),
        accountDiscountType: (account.discountType as DiscountType) || DiscountType.NONE,
        accountDiscountValue: Number(account.discountValue ?? 0),
      });

      const accountPaid = account.payments.reduce(
        (sum: number, p: any) => sum + Number(p.amount),
        0
      );
      const pendingAmount = result.total - accountPaid;

      totalSales += result.total;
      totalPaid += accountPaid;

      for (const payment of account.payments) {
        const method = payment.method as PaymentMethodType;
        paymentsByMethod[method] += Number(payment.amount);
      }

      accounts.push({
        id: account.id,
        number: account.number,
        name: account.name,
        status: account.status as 'OPEN' | 'CLOSED',
        total: result.total,
        paid: accountPaid,
        pendingAmount,
      });
    }

    return {
      id: shift.id,
      status: shift.status as 'OPEN' | 'CLOSED',
      openedAt: shift.createdAt.toISOString(),
      closedAt: shift.updatedAt.toISOString(),
      accountsCount: shift.accounts.length,
      totalSales,
      totalPaid,
      pendingAmount: totalSales - totalPaid,
      paymentsByMethod,
      accounts,
    };
  }

  static async exportToExcel(shiftId: string): Promise<Buffer | null> {
    const summary = await this.getShiftSummary(shiftId);
    if (!summary) return null;

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Bárbaro\'s POS';

    // Sheet 1: Resumen
    const resumeSheet = workbook.addWorksheet('Resumen');
    resumeSheet.columns = [
      { header: 'Turno', key: 'turno', width: 15 },
      { header: 'Desde', key: 'desde', width: 25 },
      { header: 'Hasta', key: 'hasta', width: 25 },
      { header: 'Cuentas', key: 'cuentas', width: 10 },
      { header: 'Total Ventas', key: 'totalVentas', width: 20 },
      { header: 'Total Pagado', key: 'totalPagado', width: 20 },
      { header: 'Pendiente', key: 'pendiente', width: 20 },
    ];
    resumeSheet.addRow({
      turno: summary.id.slice(0, 8),
      desde: summary.openedAt,
      hasta: summary.closedAt ?? 'Abierto',
      cuentas: summary.accountsCount,
      totalVentas: formatCOP(summary.totalSales),
      totalPagado: formatCOP(summary.totalPaid),
      pendiente: formatCOP(summary.pendingAmount),
    });

    // Sheet 2: Cuentas
    const accountsSheet = workbook.addWorksheet('Cuentas');
    accountsSheet.columns = [
      { header: '#', key: 'number', width: 5 },
      { header: 'Nombre', key: 'name', width: 30 },
      { header: 'Estado', key: 'status', width: 12 },
      { header: 'Total', key: 'total', width: 15 },
      { header: 'Pagado', key: 'paid', width: 15 },
      { header: 'Pendiente', key: 'pendingAmount', width: 15 },
    ];
    for (const account of summary.accounts) {
      accountsSheet.addRow({
        number: account.number,
        name: account.name,
        status: account.status,
        total: formatCOP(account.total),
        paid: formatCOP(account.paid),
        pendingAmount: formatCOP(account.pendingAmount),
      });
    }

    // Sheet 3: Pagos por Método
    const paymentsSheet = workbook.addWorksheet('Pagos por Método');
    paymentsSheet.columns = [
      { header: 'Método', key: 'method', width: 20 },
      { header: 'Total', key: 'total', width: 15 },
    ];
    const methodLabels: Record<PaymentMethodType, string> = {
      CASH: 'Efectivo',
      TRANSFER: 'Transferencia',
      CARD: 'Tarjeta',
    };
    for (const [method, total] of Object.entries(summary.paymentsByMethod)) {
      paymentsSheet.addRow({
        method: methodLabels[method as PaymentMethodType] ?? method,
        total: formatCOP(total),
      });
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }
}
