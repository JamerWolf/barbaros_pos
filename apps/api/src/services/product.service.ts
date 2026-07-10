import { prisma } from '../db/prisma.js';
import { ImportResult } from '@barbaros/shared';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

  static parseCSV(csvText: string): string[][] {
    const clean = csvText.replace(/^\uFEFF/, '');
    const lines = clean.split(/\r?\n/).filter((line) => line.trim() !== '');
    if (lines.length === 0) return [];

    // Auto-detect separator: count semicolons vs commas in the header line.
    // If the header has more semicolons than commas, use ';'. Otherwise ','.
    const header = lines[0];
    const semicolons = (header.match(/;/g) || []).length;
    const commas = (header.match(/,/g) || []).length;
    const sep = semicolons > commas ? ';' : ',';

    return lines.map((line) => line.split(sep).map((cell) => cell.trim()));
  }

  static async importProducts(rows: string[][], photos: Map<string, Buffer>): Promise<ImportResult> {
    const result: ImportResult = { created: 0, skipped: 0, errors: [] };

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const nombre = row[0];
      const precioStr = row[1];
      const categoria = row[2];
      const foto = row[3];

      if (!nombre || !nombre.trim()) {
        result.errors.push(`Fila ${i + 1}: nombre requerido`);
        continue;
      }

      const precio = parseFloat(precioStr);
      if (isNaN(precio) || precio < 0) {
        result.errors.push(`Fila ${i + 1}: precio inválido`);
        continue;
      }

      const existing = await prisma.product.findFirst({
        where: { name: { equals: nombre.trim(), mode: 'insensitive' } },
      });
      if (existing) {
        result.skipped++;
        continue;
      }

      let categoryId: string | undefined;
      if (categoria && categoria.trim()) {
        let category = await prisma.category.findFirst({
          where: { name: { equals: categoria.trim(), mode: 'insensitive' } },
        });
        if (!category) {
          category = await prisma.category.create({ data: { name: categoria.trim() } });
        }
        categoryId = category.id;
      }

      const product = await prisma.product.create({
        data: {
          name: nombre.trim(),
          price: precio,
          categoryId,
        },
      });

      if (foto && foto.trim()) {
        const lowerFoto = foto.trim().toLowerCase();
        let photoBuffer: Buffer | undefined;
        for (const [key, value] of photos) {
          if (key.toLowerCase() === lowerFoto) {
            photoBuffer = value;
            break;
          }
        }

        if (photoBuffer) {
          const ext = path.extname(foto.trim()).toLowerCase() || '.jpg';
          const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
          // __dirname is apps/api/src/services/, so ../../uploads/products = apps/api/uploads/products
          const uploadsDir = path.join(__dirname, '../../uploads/products');
          try {
            await fs.mkdir(uploadsDir, { recursive: true });
            await fs.writeFile(path.join(uploadsDir, filename), photoBuffer);
            await prisma.product.update({
              where: { id: product.id },
              data: { photoUrl: `uploads/products/${filename}` },
            });
          } catch (saveErr: any) {
            console.error(`[import] Failed to save photo "${foto}": ${saveErr.message} (dir: ${uploadsDir})`);
          }
        }
      }

      result.created++;
    }

    return result;
  }
}
