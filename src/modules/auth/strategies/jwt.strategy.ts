import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import * as bcrypt from 'bcrypt';
import type { Request } from 'express';
import * as sql from 'mssql';
import { ExtractJwt, Strategy } from 'passport-jwt';

import { DatabaseService } from '../../../database/database.service';
import { AuthenticatedUser } from '../types/authenticated-user.type';

interface JwtPayload {
  idUsuario?: string;
  nombreCompleto?: string;
  correo?: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly databaseService: DatabaseService,
  ) {
    const secret = configService.get<string>('JWT_SECRET');

    if (!secret) {
      throw new Error('JWT_SECRET no esta configurado.');
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      passReqToCallback: true,
      secretOrKey: secret,
    });
  }

  async validate(
    request: Request,
    payload: JwtPayload,
  ): Promise<AuthenticatedUser> {
    if (!payload.idUsuario || !payload.correo || !payload.nombreCompleto) {
      throw new UnauthorizedException('Token invalido.');
    }

    const accessToken = this.extraerBearerToken(request);
    const sesionActiva = await this.validarSesionActiva(
      payload.idUsuario,
      accessToken,
    );

    if (!sesionActiva) {
      throw new UnauthorizedException('Sesion no encontrada o inactiva.');
    }

    return {
      idUsuario: payload.idUsuario,
      nombreCompleto: payload.nombreCompleto,
      correo: payload.correo,
    };
  }

  private extraerBearerToken(request: Request): string {
    const authorizationHeader = request.get('authorization');
    const [tipo, token] = authorizationHeader?.split(' ') ?? [];

    if (tipo !== 'Bearer' || !token) {
      throw new UnauthorizedException('Token de autorizacion invalido.');
    }

    return token;
  }

  private async validarSesionActiva(
    idUsuario: string,
    accessToken: string,
  ): Promise<boolean> {
    const request = await this.databaseService.createRequest();
    request.input('IdUsuario', sql.UniqueIdentifier, idUsuario);

    const result = await request.query<{ tokenHash: string }>(`
      SELECT TokenHash AS tokenHash
      FROM Soporte.Sesion
      WHERE IdUsuario = @IdUsuario
        AND Activa = 1
        AND FechaExpiracion >= SYSDATETIME()
        AND TokenHash IS NOT NULL
      ORDER BY FechaInicio DESC;
    `);

    for (const sesion of result.recordset) {
      if (await bcrypt.compare(accessToken, sesion.tokenHash)) {
        return true;
      }
    }

    return false;
  }
}
