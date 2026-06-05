import {
  Controller,
  Get,
  Query,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuthenticatedRequest } from '../auth/types/authenticated-user.type';
import { ConsultarReporteDto } from './dto/consultar-reporte.dto';
import { ReportesService } from './reportes.service';

@UseGuards(JwtAuthGuard)
@Controller('reportes')
export class ReportesController {
  constructor(private readonly reportesService: ReportesService) {}

  @Get('resumen')
  consultarResumen(
    @Req() request: AuthenticatedRequest,
    @Query() filtros: ConsultarReporteDto,
  ) {
    return this.reportesService.consultarResumen(
      this.getIdUsuario(request),
      filtros,
    );
  }

  @Get('movimientos')
  consultarMovimientos(
    @Req() request: AuthenticatedRequest,
    @Query() filtros: ConsultarReporteDto,
  ) {
    return this.reportesService.consultarMovimientos(
      this.getIdUsuario(request),
      filtros,
    );
  }

  @Get('exportar-pdf')
  async exportarPdf(
    @Req() request: AuthenticatedRequest,
    @Query() filtros: ConsultarReporteDto,
    @Res() response: Response,
  ): Promise<void> {
    const reportePdf = await this.reportesService.exportarPdf(
      this.getIdUsuario(request),
      filtros,
    );

    response.setHeader('Content-Type', 'application/pdf');
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="${reportePdf.filename}"`,
    );
    response.send(reportePdf.buffer);
  }

  private getIdUsuario(request: AuthenticatedRequest): string {
    const idUsuario = request.user?.idUsuario;

    if (!idUsuario) {
      throw new UnauthorizedException('Usuario no autenticado.');
    }

    return idUsuario;
  }
}
