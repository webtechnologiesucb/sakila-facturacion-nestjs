import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { HealthModule } from './health/health.module';
import { AuditModule } from './audit/audit.module';
import { SakilaModule } from './sakila/sakila.module';
import { CustomersModule } from './customers/customers.module';
import { ProductsModule } from './products/products.module';
import { TaxConfigurationModule } from './tax-configuration/tax-configuration.module';
import { TaxCalculationModule } from './tax-calculation/tax-calculation.module';
import { TaxAuthorityModule } from './tax-authority/tax-authority.module';
import { XmlGenerationModule } from './xml-generation/xml-generation.module';
import { DigitalSignatureModule } from './digital-signature/digital-signature.module';
import { InvoicesModule } from './invoices/invoices.module';
import { CancellationModule } from './cancellation/cancellation.module';
import { ContingencyModule } from './contingency/contingency.module';
import { ReportsModule } from './reports/reports.module';
import { envValidation } from './config/env.validation';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      validate: envValidation,
    }),
    ThrottlerModule.forRootAsync({
      useFactory: () => [
        {
          name: 'default',
          ttl: Number(process.env.THROTTLE_TTL || 60) * 1000,
          limit: Number(process.env.THROTTLE_LIMIT || 100),
        },
      ],
    }),
    PrismaModule,
    AuthModule,
    UsersModule,
    HealthModule,
    AuditModule,
    SakilaModule,
    CustomersModule,
    ProductsModule,
    TaxConfigurationModule,
    TaxCalculationModule,
    TaxAuthorityModule,
    XmlGenerationModule,
    DigitalSignatureModule,
    InvoicesModule,
    CancellationModule,
    ContingencyModule,
    ReportsModule,
  ],
  controllers: [AppController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
