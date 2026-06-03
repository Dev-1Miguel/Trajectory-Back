import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuthenticatedRequest } from '../auth/types/authenticated-user.type';
import { ActualizarMovimientoDto } from './dto/actualizar-movimiento.dto';
import { ConsultarMovimientoDto } from './dto/consultar-movimiento.dto';
import { CrearMovimientoDto } from './dto/crear-movimiento.dto';
import { MovimientosService } from './movimientos.service';

@UseGuards(JwtAuthGuard)
@Controller('movimientos')
export class MovimientosController {
  constructor(private readonly movimientosService: MovimientosService) {}

  @Post()
  crear(
    @Req() request: AuthenticatedRequest,
    @Body() crearMovimientoDto: CrearMovimientoDto,
  ) {
    return this.movimientosService.crear(
      this.getIdUsuario(request),
      crearMovimientoDto,
    );
  }

  @Get()
  consultar(
    @Req() request: AuthenticatedRequest,
    @Query() filtros: ConsultarMovimientoDto,
  ) {
    return this.movimientosService.consultar(
      this.getIdUsuario(request),
      filtros,
    );
  }

  @Put(':id')
  actualizar(
    @Param('id', ParseIntPipe) id: number,
    @Req() request: AuthenticatedRequest,
    @Body() actualizarMovimientoDto: ActualizarMovimientoDto,
  ) {
    return this.movimientosService.actualizar(
      id,
      this.getIdUsuario(request),
      actualizarMovimientoDto,
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
