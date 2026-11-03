import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { ProductsController, ProductCategoriesController } from './products.controller';
import { ProductsService } from './products.service';

@Module({
  imports: [AuditModule],
  controllers: [ProductsController, ProductCategoriesController],
  providers: [ProductsService],
  exports: [ProductsService],
})
export class ProductsModule {}
