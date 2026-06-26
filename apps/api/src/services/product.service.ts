import { prisma } from '../db/prisma.js';

export class ProductService {
  static async listCategories() {
    return prisma.category.findMany({ orderBy: { name: 'asc' } });
  }

  static async createCategory(name: string) {
    return prisma.category.create({ data: { name } });
  }

  static async updateCategory(id: string, name: string) {
    return prisma.category.update({ where: { id }, data: { name } });
  }

  static async deleteCategory(id: string) {
    const products = await prisma.product.findMany({ where: { categoryId: id } });
    if (products.length > 0) {
      await prisma.product.updateMany({ where: { categoryId: id }, data: { categoryId: null } });
    }
    return prisma.category.delete({ where: { id } });
  }

  static async listProducts(activeOnly?: boolean) {
    return prisma.product.findMany({
      where: activeOnly !== undefined ? { active: activeOnly } : undefined,
      include: { category: true },
      orderBy: { name: 'asc' }
    });
  }

  static async getProduct(id: string) {
    return prisma.product.findUnique({ where: { id }, include: { category: true } });
  }

  static async createProduct(data: { name: string; price: number; categoryId?: string; photoUrl?: string; active?: boolean }) {
    return prisma.product.create({ data, include: { category: true } });
  }

  static async updateProduct(id: string, data: { name?: string; price?: number; categoryId?: string; photoUrl?: string; active?: boolean }) {
    return prisma.product.update({ where: { id }, data, include: { category: true } });
  }

  static async deleteProduct(id: string) {
    const items = await prisma.orderItem.findFirst({ where: { productId: id, account: { status: 'OPEN' } } });
    if (items) {
      throw new Error('Cannot delete product that is in an open account');
    }
    return prisma.product.delete({ where: { id } });
  }
}
