import { Module } from '@nestjs/common';

import { MovimientosModule } from '../movimientos/movimientos.module';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [MovimientosModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
