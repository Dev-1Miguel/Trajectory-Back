import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
} from '@nestjs/common';

import { ActualizarMovimientoDto } from './dto/actualizar-movimiento.dto';
import { ConsultarMovimientoDto } from './dto/consultar-movimiento.dto';
import { CrearMovimientoDto } from './dto/crear-movimiento.dto';
import { MovimientosService } from './movimientos.service';

@Controller('movimientos')
export class MovimientosController {
  constructor(private readonly movimientosService: MovimientosService) {}

  @Post()
  crear(@Body() crearMovimientoDto: CrearMovimientoDto) {
    return this.movimientosService.crear(crearMovimientoDto);
  }

  @Get()
  consultar(@Query() filtros: ConsultarMovimientoDto) {
    return this.movimientosService.consultar(filtros);
  }

  @Put(':id')
  actualizar(
    @Param('id', ParseIntPipe) id: number,
    @Body() actualizarMovimientoDto: ActualizarMovimientoDto,
  ) {
    return this.movimientosService.actualizar(id, actualizarMovimientoDto);
  }
}
