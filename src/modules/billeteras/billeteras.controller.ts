import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Query,
  Req,
} from '@nestjs/common';

import { AuthenticatedRequest } from '../auth/types/authenticated-user.type';
import { BilleterasService } from './billeteras.service';
import { ActualizarBilleteraDto } from './dto/actualizar-billetera.dto';
import { CambiarEstadoBilleteraDto } from './dto/cambiar-estado-billetera.dto';
import { ConsultarBilleteraDto } from './dto/consultar-billetera.dto';
import { CrearBilleteraDto } from './dto/crear-billetera.dto';
import { MarcarPrincipalBilleteraDto } from './dto/marcar-principal-billetera.dto';

const LOCAL_DEVELOPMENT_USER_ID = 'FE391053-CD3E-4050-A053-C52D6608C2EC';

@Controller('billeteras')
export class BilleterasController {
  constructor(private readonly billeterasService: BilleterasService) {}

  @Post()
  crear(
    @Req() request: AuthenticatedRequest,
    @Body() crearBilleteraDto: CrearBilleteraDto,
  ) {
    return this.billeterasService.crear(
      this.getIdUsuario(request),
      crearBilleteraDto,
    );
  }

  @Get()
  consultar(
    @Req() request: AuthenticatedRequest,
    @Query() filtros: ConsultarBilleteraDto,
  ) {
    return this.billeterasService.consultar(
      this.getIdUsuario(request),
      filtros,
    );
  }

  @Put(':id')
  actualizar(
    @Param('id', ParseIntPipe) id: number,
    @Req() request: AuthenticatedRequest,
    @Body() actualizarBilleteraDto: ActualizarBilleteraDto,
  ) {
    return this.billeterasService.actualizar(
      id,
      this.getIdUsuario(request),
      actualizarBilleteraDto,
    );
  }

  @Patch(':id/estado')
  cambiarEstado(
    @Param('id', ParseIntPipe) id: number,
    @Req() request: AuthenticatedRequest,
    @Body() cambiarEstadoBilleteraDto: CambiarEstadoBilleteraDto,
  ) {
    return this.billeterasService.cambiarEstado(
      id,
      this.getIdUsuario(request),
      cambiarEstadoBilleteraDto,
    );
  }

  @Patch(':id/principal')
  marcarPrincipal(
    @Param('id', ParseIntPipe) id: number,
    @Req() request: AuthenticatedRequest,
    @Body() _marcarPrincipalBilleteraDto: MarcarPrincipalBilleteraDto,
  ) {
    return this.billeterasService.marcarPrincipal(
      id,
      this.getIdUsuario(request),
    );
  }

  private getIdUsuario(request: AuthenticatedRequest): string {
    return request.user?.idUsuario ?? LOCAL_DEVELOPMENT_USER_ID;
  }
}
