import { FastifyPluginAsync } from 'fastify';
import { ProductService } from '../../services/product.service.js';

const productRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/', async (request, reply) => {
    const { active } = request.query as { active?: string };
    const activeOnly = active !== undefined ? active === 'true' : undefined;
    const products = await ProductService.listProducts(activeOnly);
    return reply.code(200).send(products);
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
