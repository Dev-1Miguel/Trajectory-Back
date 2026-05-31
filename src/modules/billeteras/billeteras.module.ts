import { Module } from '@nestjs/common';

import { BilleterasController } from './billeteras.controller';
import { BilleterasService } from './billeteras.service';

@Module({
  controllers: [BilleterasController],
  providers: [BilleterasService],
  exports: [BilleterasService],
})
export class BilleterasModule {}
