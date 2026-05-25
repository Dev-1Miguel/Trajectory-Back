import { Body, Controller, Get, Put } from '@nestjs/common';

import { ActualizarInformacionPersonalDto } from './dto/actualizar-informacion-personal.dto';
import { PerfilService } from './perfil.service';

@Controller('perfil')
export class PerfilController {
  constructor(private readonly perfilService: PerfilService) {}

  @Get('informacion-personal')
  obtenerInformacionPersonal() {
    return this.perfilService.obtenerInformacionPersonal();
  }

  @Put('informacion-personal')
  actualizarInformacionPersonal(
    @Body() actualizarInformacionPersonalDto: ActualizarInformacionPersonalDto,
  ) {
    return this.perfilService.actualizarInformacionPersonal(
      actualizarInformacionPersonalDto,
    );
  }
}
