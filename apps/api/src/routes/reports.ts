import { FastifyPluginAsync } from 'fastify';
import { ReportService } from '../services/report.service.js';

const reportRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/export/:shiftId', async (request, reply) => {
    try {
      const { shiftId } = request.params as { shiftId: string };
      const buffer = await ReportService.exportToExcel(shiftId);
      if (!buffer) {
        return reply.code(404).send({ error: 'Shift not found' });
      }
      return reply
        .header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
        .header('Content-Disposition', `attachment; filename="reporte_${shiftId}.xlsx"`)
        .send(buffer);
    } catch (err: any) {
      return reply.code(500).send({ error: err.message });
    }
  });
};

export default reportRoutes;
