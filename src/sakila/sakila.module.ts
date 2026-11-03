import { Module } from '@nestjs/common';
import { SakilaController } from './sakila.controller';
import { SakilaService } from './sakila.service';

@Module({
  controllers: [SakilaController],
  providers: [SakilaService],
  exports: [SakilaService],
})
export class SakilaModule {}
