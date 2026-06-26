import { FastifyPluginAsync } from 'fastify';
import { ProductService } from '../../services/product.service.js';

const categoryRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/', async (_request, reply) => {
    const categories = await ProductService.listCategories();
    return reply.code(200).send(categories);
  });

  fastify.post('/', async (request, reply) => {
    const { name } = request.body as { name?: string };
    if (!name?.trim()) return reply.code(400).send({ error: 'Name is required' });

    try {
      const category = await ProductService.createCategory(name.trim());
      return reply.code(201).send(category);
    } catch (err: any) {
      return reply.code(400).send({ error: err.message });
    }
  });

  fastify.put('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { name } = request.body as { name?: string };
    if (!name?.trim()) return reply.code(400).send({ error: 'Name is required' });

    try {
      const category = await ProductService.updateCategory(id, name.trim());
      return reply.code(200).send(category);
    } catch (err: any) {
      return reply.code(400).send({ error: err.message });
    }
  });

  fastify.delete('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    try {
      await ProductService.deleteCategory(id);
      return reply.code(204).send();
    } catch (err: any) {
      return reply.code(400).send({ error: err.message });
    }
  });
};

export default categoryRoutes;
