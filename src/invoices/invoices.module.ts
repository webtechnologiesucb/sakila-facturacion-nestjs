import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { TaxConfigurationModule } from '../tax-configuration/tax-configuration.module';
import { TaxCalculationModule } from '../tax-calculation/tax-calculation.module';
import { TaxAuthorityModule } from '../tax-authority/tax-authority.module';
import { XmlGenerationModule } from '../xml-generation/xml-generation.module';
import { DigitalSignatureModule } from '../digital-signature/digital-signature.module';
import { InvoicesController } from './invoices.controller';
import { InvoicesService } from './invoices.service';

@Module({
  imports: [
    AuditModule,
    TaxConfigurationModule,
    TaxCalculationModule,
    TaxAuthorityModule,
    XmlGenerationModule,
    DigitalSignatureModule,
  ],
  controllers: [InvoicesController],
  providers: [InvoicesService],
  exports: [InvoicesService],
})
export class InvoicesModule {}
