import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { DigitalSignatureService } from './digital-signature.service';
import { SIGNATURE_PROVIDER } from './signature.types';
import { SimulatedSignatureProvider } from './simulated-signature.provider';
import { UnconfiguredSignatureProvider } from './unconfigured-signature.provider';

@Module({
  imports: [ConfigModule],
  providers: [
    DigitalSignatureService,
    {
      provide: SIGNATURE_PROVIDER,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const mode = (config.get<string>('SIGNATURE_PROVIDER') || 'simulated').toLowerCase();
        return mode === 'unconfigured'
          ? new UnconfiguredSignatureProvider()
          : new SimulatedSignatureProvider();
      },
    },
  ],
  exports: [DigitalSignatureService, SIGNATURE_PROVIDER],
})
export class DigitalSignatureModule {}
