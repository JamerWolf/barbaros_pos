import { FastifyPluginAsync } from 'fastify';
import { AccountService } from '../../services/account.service.js';

const shiftRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post('/open', async (request, reply) => {
    try {
      const shift = await AccountService.openShift();
      return reply.code(201).send(shift);
    } catch (err: any) {
      return reply.code(400).send({ error: err.message });
    }
  });

  fastify.post('/close', async (request, reply) => {
    try {
      const shift = await AccountService.closeShift();
      return reply.code(200).send(shift);
    } catch (err: any) {
      return reply.code(400).send({ error: err.message });
    }
  });
};

export default shiftRoutes;
