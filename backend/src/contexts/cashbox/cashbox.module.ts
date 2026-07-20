import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CashboxController } from './cashbox.controller';
import { CashboxService } from './cashbox.service';
import { CashClosing } from './domain/cash-closing.entity';

@Module({
  imports: [TypeOrmModule.forFeature([CashClosing])],
  controllers: [CashboxController],
  providers: [CashboxService],
  exports: [CashboxService],
})
export class CashboxModule {}
