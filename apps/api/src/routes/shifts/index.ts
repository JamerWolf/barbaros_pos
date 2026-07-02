import { FastifyPluginAsync } from 'fastify';
import { AccountService } from '../../services/account.service.js';
import { ReportService } from '../../services/report.service.js';

function emitSocketEvent(fastify: any, event: string, payload: any) {
  if (fastify.websocketServer) {
    fastify.websocketServer.clients.forEach((client: any) => {
      if (client.readyState === 1) {
        client.send(JSON.stringify({ event, data: payload }));
      }
    });
  }
}

const shiftRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/active', async (request, reply) => {
    try {
      const shift = await AccountService.getActiveShift();
      return reply.code(200).send(shift ? { id: shift.id } : null);
    } catch (err: any) {
      return reply.code(500).send({ error: err.message });
    }
  });

  fastify.get('/', async (request, reply) => {
    try {
      const { from, to } = request.query as { from?: string; to?: string };
      const shifts = await ReportService.listShifts(from, to);
      return reply.code(200).send(shifts);
    } catch (err: any) {
      return reply.code(500).send({ error: err.message });
    }
  });

  fastify.get('/:id', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const summary = await ReportService.getShiftSummary(id);
      if (!summary) {
        return reply.code(404).send({ error: 'Shift not found' });
      }
      return reply.code(200).send(summary);
    } catch (err: any) {
      return reply.code(500).send({ error: err.message });
    }
  });

  fastify.post('/open', async (request, reply) => {
    try {
      const shift = await AccountService.openShift();
      emitSocketEvent(fastify, 'shift:opened', shift);
      return reply.code(201).send(shift);
    } catch (err: any) {
      return reply.code(400).send({ error: err.message });
    }
  });

  fastify.post('/close', async (request, reply) => {
    try {
      const shift = await AccountService.closeShift();
      emitSocketEvent(fastify, 'shift:closed', shift);
      return reply.code(200).send(shift);
    } catch (err: any) {
      return reply.code(400).send({ error: err.message });
    }
  });
};

export default shiftRoutes;
