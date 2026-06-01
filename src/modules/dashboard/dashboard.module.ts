import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { MovimientosModule } from '../movimientos/movimientos.module';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [AuthModule, MovimientosModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
