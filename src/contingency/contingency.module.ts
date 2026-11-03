import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { ContingencyController } from './contingency.controller';
import { ContingencyService } from './contingency.service';

@Module({
  imports: [AuditModule],
  controllers: [ContingencyController],
  providers: [ContingencyService],
  exports: [ContingencyService],
})
export class ContingencyModule {}
