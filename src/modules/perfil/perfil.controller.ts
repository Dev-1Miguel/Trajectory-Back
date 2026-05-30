import { Body, Controller, Get, Put, Req, UseGuards } from '@nestjs/common';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuthenticatedRequest } from '../auth/types/authenticated-user.type';
import { ActualizarInformacionPersonalDto } from './dto/actualizar-informacion-personal.dto';
import { PerfilService } from './perfil.service';

@UseGuards(JwtAuthGuard)
@Controller('perfil')
export class PerfilController {
  constructor(private readonly perfilService: PerfilService) {}

  @Get('informacion-personal')
  obtenerInformacionPersonal(@Req() request: AuthenticatedRequest) {
    return this.perfilService.obtenerInformacionPersonal(
      request.user.idUsuario,
    );
  }

  @Put('informacion-personal')
  actualizarInformacionPersonal(
    @Req() request: AuthenticatedRequest,
    @Body() actualizarInformacionPersonalDto: ActualizarInformacionPersonalDto,
  ) {
    return this.perfilService.actualizarInformacionPersonal(
      request.user.idUsuario,
      actualizarInformacionPersonalDto,
    );
  }
}
