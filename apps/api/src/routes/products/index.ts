import { FastifyPluginAsync } from 'fastify';
import { ProductService } from '../../services/product.service.js';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const productRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/', async (request, reply) => {
    const { active } = request.query as { active?: string };
    const activeOnly = active !== undefined ? active === 'true' : undefined;
    const products = await ProductService.listProducts(activeOnly);
    return reply.code(200).send(products);
  });

  fastify.post('/import', async (request, reply) => {
    try {
      const parts = request.parts();
      let csvText: string | undefined;
      const photos = new Map<string, Buffer>();

      for await (const part of parts) {
        if (part.type === 'file' && part.fieldname === 'file') {
          const buffer = await part.toBuffer();
          if (buffer.length > 5 * 1024 * 1024) {
            return reply.code(400).send({ error: 'El archivo CSV debe ser menor a 5MB' });
          }
          csvText = buffer.toString('utf-8');
        } else if (part.type === 'file' && part.fieldname === 'photos') {
          const buffer = await part.toBuffer();
          if (buffer.length > 5 * 1024 * 1024) {
            return reply.code(400).send({ error: `La foto "${part.filename}" debe ser menor a 5MB` });
          }
          photos.set(part.filename, buffer);
        }
      }

      fastify.log.info(`[import] CSV received: ${csvText ? 'yes' : 'no'}, photos: ${photos.size}`);

      if (!csvText) {
        return reply.code(400).send({ error: 'No CSV file provided' });
      }

      const rows = ProductService.parseCSV(csvText);
      if (rows.length < 2) {
        return reply.code(400).send({ error: 'CSV file is empty or has no data rows' });
      }

      const result = await ProductService.importProducts(rows, photos);
      return reply.code(200).send(result);
    } catch (err: any) {
      fastify.log.error(`[import] Error: ${err.message}`);
      return reply.code(400).send({ error: err.message });
    }
  });

  fastify.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const product = await ProductService.getProduct(id);
    if (!product) return reply.code(404).send({ error: 'Product not found' });
    return reply.code(200).send(product);
  });

  fastify.post('/', async (request, reply) => {
    const body = request.body as { name?: string; price?: number; categoryId?: string; photoUrl?: string; active?: boolean };
    if (!body.name?.trim()) return reply.code(400).send({ error: 'Name is required' });
    if (body.price === undefined || body.price < 0) return reply.code(400).send({ error: 'Valid price is required' });

    try {
      const product = await ProductService.createProduct({
        name: body.name.trim(),
        price: body.price,
        categoryId: body.categoryId,
        photoUrl: body.photoUrl,
        active: body.active,
      });
      return reply.code(201).send(product);
    } catch (err: any) {
      return reply.code(400).send({ error: err.message });
    }
  });

  fastify.put('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as { name?: string; price?: number; categoryId?: string; photoUrl?: string; active?: boolean };

    try {
      const product = await ProductService.updateProduct(id, {
        name: body.name?.trim(),
        price: body.price,
        categoryId: body.categoryId,
        photoUrl: body.photoUrl,
        active: body.active,
      });
      return reply.code(200).send(product);
    } catch (err: any) {
      return reply.code(400).send({ error: err.message });
    }
  });

  fastify.post('/:id/photo', async (request, reply) => {
    const { id } = request.params as { id: string };

    const product = await ProductService.getProduct(id);
    if (!product) return reply.code(404).send({ error: 'Product not found' });

    try {
      const parts = request.parts();
      let photoUrl: string | undefined;

      for await (const part of parts) {
        if (part.type === 'file') {
          const ext = path.extname(part.filename).toLowerCase();
          if (!['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) {
            return reply.code(400).send({ error: 'Solo se aceptan JPG, PNG o WebP' });
          }

          const uploadsDir = path.join(__dirname, '../../../uploads/products');
          await fs.mkdir(uploadsDir, { recursive: true });

          const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
          const filepath = path.join(uploadsDir, filename);

          const buffer = await part.toBuffer();
          if (buffer.length > 5 * 1024 * 1024) {
            return reply.code(400).send({ error: 'La imagen debe ser menor a 5MB' });
          }
          await fs.writeFile(filepath, buffer);
          photoUrl = `uploads/products/${filename}`;
        }
      }

      if (!photoUrl) {
        return reply.code(400).send({ error: 'No se envió ninguna imagen' });
      }

      const updated = await ProductService.updateProduct(id, { photoUrl });
      return reply.code(200).send(updated);
    } catch (err: any) {
      return reply.code(400).send({ error: err.message });
    }
  });

  fastify.delete('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    try {
      await ProductService.deleteProduct(id);
      return reply.code(204).send();
    } catch (err: any) {
      const status = err.message.includes('open account') ? 409 : 400;
      return reply.code(status).send({ error: err.message });
    }
  });
};

export default productRoutes;
