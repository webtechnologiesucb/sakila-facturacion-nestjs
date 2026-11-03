import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface AuditContext {
  actorId?: string;
  ip?: string;
  userAgent?: string;
  correlationId?: string;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Registra una acción crítica. No se guardan secretos ni payloads completos
   * de tarjetas, certificados o credenciales.
   */
  async log(
    action: string,
    entity: string,
    entityId: string | null,
    before: unknown,
    after: unknown,
    ctx: AuditContext = {},
  ): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          actorId: ctx.actorId || null,
          action,
          entity,
          entityId: entityId || null,
          before: before === undefined ? undefined : (before as any),
          after: after === undefined ? undefined : (after as any),
          ip: ctx.ip?.slice(0, 60),
          userAgent: ctx.userAgent?.slice(0, 500),
        },
      });
    } catch (error) {
      // La auditoría no debe tumbar la operación principal, pero se alerta.
      this.logger.error(`No se pudo registrar auditoría ${action}/${entity}`);
    }
  }

  async list(page: number, limit: number, entity?: string) {
    const where = entity ? { entity } : {};
    const [data, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.auditLog.count({ where }),
    ]);
    return {
      data,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }
}
