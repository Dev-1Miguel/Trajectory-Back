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
} from '@nestjs/common';

import { CategoriasService } from './categorias.service';
import { ActualizarCategoriaDto } from './dto/actualizar-categoria.dto';
import { CambiarEstadoCategoriaDto } from './dto/cambiar-estado-categoria.dto';
import { ConsultarCategoriaDto } from './dto/consultar-categoria.dto';
import { CrearCategoriaDto } from './dto/crear-categoria.dto';

@Controller('categorias')
export class CategoriasController {
  constructor(private readonly categoriasService: CategoriasService) {}

  @Post()
  crear(@Body() crearCategoriaDto: CrearCategoriaDto) {
    return this.categoriasService.crear(crearCategoriaDto);
  }

  @Get()
  consultar(@Query() filtros: ConsultarCategoriaDto) {
    return this.categoriasService.consultar(filtros);
  }

  @Put(':id')
  actualizar(
    @Param('id', ParseIntPipe) id: number,
    @Body() actualizarCategoriaDto: ActualizarCategoriaDto,
  ) {
    return this.categoriasService.actualizar(id, actualizarCategoriaDto);
  }

  @Patch(':id/estado')
  cambiarEstado(
    @Param('id', ParseIntPipe) id: number,
    @Body() cambiarEstadoCategoriaDto: CambiarEstadoCategoriaDto,
  ) {
    return this.categoriasService.cambiarEstado(
      id,
      cambiarEstadoCategoriaDto,
    );
  }
}
