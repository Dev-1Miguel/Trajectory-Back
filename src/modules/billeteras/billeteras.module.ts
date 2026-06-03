import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { BilleterasController } from './billeteras.controller';
import { BilleterasService } from './billeteras.service';

@Module({
  imports: [AuthModule],
  controllers: [BilleterasController],
  providers: [BilleterasService],
  exports: [BilleterasService],
})
export class BilleterasModule {}
