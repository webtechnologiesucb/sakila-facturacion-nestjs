import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TaxConfigurationModule } from '../tax-configuration/tax-configuration.module';
import { TaxAuthorityController } from './tax-authority.controller';
import { TaxAuthorityService } from './tax-authority.service';
import { MockTaxAuthorityProvider } from './mock-tax-authority.provider';
import { SiatTaxAuthorityProvider } from './siat-tax-authority.provider';
import { TAX_AUTHORITY_PROVIDER } from './tax-authority.types';

@Module({
  imports: [ConfigModule, TaxConfigurationModule],
  controllers: [TaxAuthorityController],
  providers: [
    TaxAuthorityService,
    {
      provide: TAX_AUTHORITY_PROVIDER,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const mode = (config.get<string>('SIAT_MODE') || 'simulated').toLowerCase();
        if (mode === 'real') {
          return new SiatTaxAuthorityProvider(config);
        }
        return new MockTaxAuthorityProvider();
      },
    },
  ],
  exports: [TaxAuthorityService, TAX_AUTHORITY_PROVIDER],
})
export class TaxAuthorityModule {}
