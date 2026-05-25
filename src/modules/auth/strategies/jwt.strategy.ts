import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

import { AuthenticatedUser } from '../types/authenticated-user.type';

interface JwtPayload {
  idUsuario?: string;
  nombreCompleto?: string;
  correo?: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService) {
    const secret = configService.get<string>('JWT_SECRET');

    if (!secret) {
      throw new Error('JWT_SECRET no esta configurado.');
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  validate(payload: JwtPayload): AuthenticatedUser {
    if (!payload.idUsuario || !payload.correo || !payload.nombreCompleto) {
      throw new UnauthorizedException('Token invalido.');
    }

    return {
      idUsuario: payload.idUsuario,
      nombreCompleto: payload.nombreCompleto,
      correo: payload.correo,
    };
  }
}
