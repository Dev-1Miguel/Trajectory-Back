import {
  Controller,
  Get,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuthenticatedRequest } from '../auth/types/authenticated-user.type';
import { DashboardService } from './dashboard.service';
import { ConsultarResumenDashboardDto } from './dto/consultar-resumen-dashboard.dto';

@UseGuards(JwtAuthGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('resumen')
  obtenerResumen(
    @Req() request: AuthenticatedRequest,
    @Query() filtros: ConsultarResumenDashboardDto,
  ) {
    return this.dashboardService.obtenerResumen(
      this.getIdUsuario(request),
      filtros,
    );
  }

  private getIdUsuario(request: AuthenticatedRequest): string {
    const idUsuario = request.user?.idUsuario;

    if (!idUsuario) {
      throw new UnauthorizedException('Usuario no autenticado.');
    }

    return idUsuario;
  }
}
