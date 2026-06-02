import { Body, Controller, Get, Patch, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';

import { AuthService } from './auth.service';
import { CambiarPasswordDto } from './dto/cambiar-password.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { AuthenticatedRequest } from './types/authenticated-user.type';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  login(@Body() loginDto: LoginDto, @Req() request: Request) {
    return this.authService.login(loginDto, {
      dispositivo: request.get('user-agent'),
      ip: request.ip,
    });
  }

  @Post('register')
  register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@Req() request: AuthenticatedRequest) {
    return this.authService.me(request.user);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('password')
  cambiarPassword(
    @Req() request: AuthenticatedRequest,
    @Body() cambiarPasswordDto: CambiarPasswordDto,
  ) {
    return this.authService.cambiarPassword(
      request.user.idUsuario,
      cambiarPasswordDto,
    );
  }
}
