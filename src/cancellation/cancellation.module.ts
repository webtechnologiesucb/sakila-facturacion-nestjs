import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { InvoicesModule } from '../invoices/invoices.module';
import { TaxAuthorityModule } from '../tax-authority/tax-authority.module';
import { CancellationController } from './cancellation.controller';
import { CancellationService } from './cancellation.service';

@Module({
  imports: [AuditModule, InvoicesModule, TaxAuthorityModule],
  controllers: [CancellationController],
  providers: [CancellationService],
  exports: [CancellationService],
})
export class CancellationModule {}
