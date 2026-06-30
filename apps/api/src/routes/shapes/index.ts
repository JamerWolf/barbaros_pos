import { FastifyPluginAsync } from 'fastify';
import { ShapeService } from '../../services/shape.service.js';

function emitSocketEvent(fastify: any, event: string, payload: any) {
  if (fastify.websocketServer) {
    fastify.websocketServer.clients.forEach((client: any) => {
      if (client.readyState === 1) {
        client.send(JSON.stringify({ event, data: payload }));
      }
    });
  }
}

const shapeRoutes: FastifyPluginAsync = async (fastify) => {
  // Get shapes for a shift
  fastify.get('/:shiftId', async (request, reply) => {
    const { shiftId } = request.params as { shiftId: string };
    try {
      const shapes = await ShapeService.getShapesByShift(shiftId);
      return reply.send(shapes);
    } catch (err: any) {
      return reply.code(500).send({ error: err.message });
    }
  });

  // Create shape
  fastify.post('/', async (request, reply) => {
    const body = request.body as any;
    try {
      const shape = await ShapeService.createShape(body);
      emitSocketEvent(fastify, 'shape:created', shape);
      return reply.code(201).send(shape);
    } catch (err: any) {
      return reply.code(400).send({ error: err.message });
    }
  });

  // Update shape
  fastify.put('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as any;
    try {
      const shape = await ShapeService.updateShape(id, body);
      emitSocketEvent(fastify, 'shape:updated', shape);
      return reply.send(shape);
    } catch (err: any) {
      return reply.code(400).send({ error: err.message });
    }
  });

  // Delete shape
  fastify.delete('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      await ShapeService.deleteShape(id);
      emitSocketEvent(fastify, 'shape:deleted', { id });
      return reply.code(204).send();
    } catch (err: any) {
      return reply.code(400).send({ error: err.message });
    }
  });
};

export default shapeRoutes;
