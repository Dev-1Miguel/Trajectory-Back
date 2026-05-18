import { Controller, Get, Query } from '@nestjs/common';

import { DashboardService } from './dashboard.service';
import { ConsultarResumenDashboardDto } from './dto/consultar-resumen-dashboard.dto';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('resumen')
  obtenerResumen(@Query() filtros: ConsultarResumenDashboardDto) {
    return this.dashboardService.obtenerResumen(filtros);
  }
}
