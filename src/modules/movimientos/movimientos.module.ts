import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { MovimientosController } from './movimientos.controller';
import { MovimientosService } from './movimientos.service';

@Module({
  imports: [AuthModule],
  controllers: [MovimientosController],
  providers: [MovimientosService],
  exports: [MovimientosService],
})
export class MovimientosModule {}
