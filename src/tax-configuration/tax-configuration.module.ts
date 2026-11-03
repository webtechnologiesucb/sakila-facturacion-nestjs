import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import {
  BranchesController,
  IssuersController,
  PointsOfSaleController,
  TaxConfigurationController,
  TaxRulesController,
} from './tax-configuration.controller';
import { TaxConfigurationService } from './tax-configuration.service';

@Module({
  imports: [AuditModule],
  controllers: [
    IssuersController,
    BranchesController,
    PointsOfSaleController,
    TaxConfigurationController,
    TaxRulesController,
  ],
  providers: [TaxConfigurationService],
  exports: [TaxConfigurationService],
})
export class TaxConfigurationModule {}
