import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as sql from 'mssql/msnodesqlv8';
import { randomUUID } from 'node:crypto';

import { DatabaseService } from '../../database/database.service';
import { CambiarPasswordDto } from './dto/cambiar-password.dto';
import { CerrarSesionesDto } from './dto/cerrar-sesiones.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { AuthenticatedUser } from './types/authenticated-user.type';

interface UsuarioAutenticacionRow {
  idUsuario: string;
  nombreCompleto: string;
  correo: string;
  passwordHash: string | null;
  activo: boolean | number;
}

interface LoginMetadata {
  dispositivo?: string;
  ip?: string;
}

export interface LoginResponse {
  accessToken: string;
  usuario: AuthenticatedUser;
}

export interface RegisterResponse {
  usuario: AuthenticatedUser;
}

export interface CambiarPasswordResponse {
  mensaje: string;
}

export interface ConsultarSesionesResponse {
  sesiones: Record<string, unknown>[];
}

export interface CerrarSesionesResponse {
  mensaje: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly passwordHashSaltRounds = 10;
  private readonly tokenHashSaltRounds = 10;
  private readonly usuarioStoredProcedureName = 'Soporte.SP_Usuario';

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly jwtService: JwtService,
  ) {}

  async login(
    loginDto: LoginDto,
    metadata: LoginMetadata,
  ): Promise<LoginResponse> {
    try {
      const usuario = await this.buscarUsuarioPorCorreo(loginDto.correo);

      if (!usuario) {
        throw new UnauthorizedException('Credenciales invalidas.');
      }

      if (!this.isUsuarioActivo(usuario.activo)) {
        throw new UnauthorizedException('Usuario inactivo.');
      }

      const passwordValida = await this.compararPassword(
        loginDto.password,
        usuario.passwordHash,
      );

      if (!passwordValida) {
        throw new UnauthorizedException('Credenciales invalidas.');
      }

      const usuarioAutenticado: AuthenticatedUser = {
        idUsuario: usuario.idUsuario,
        nombreCompleto: usuario.nombreCompleto,
        correo: usuario.correo,
      };
      const accessToken = await this.jwtService.signAsync(usuarioAutenticado);

      await this.registrarSesionYAuditoria(
        usuarioAutenticado.idUsuario,
        accessToken,
        metadata,
      );

      return {
        accessToken,
        usuario: usuarioAutenticado,
      };
    } catch (error: unknown) {
      this.handleError(error, 'iniciar sesion');
    }
  }

  async register(registerDto: RegisterDto): Promise<RegisterResponse> {
    let transaction: sql.Transaction | null = null;

    try {
      const pool = await this.databaseService.getPool();
      transaction = new sql.Transaction(pool);

      await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);

      const correoExistenteRequest = new sql.Request(transaction);
      correoExistenteRequest.input(
        'Correo',
        sql.NVarChar(150),
        registerDto.correo,
      );

      const correoExistenteResult = await correoExistenteRequest.query<{
        existe: number;
      }>(`
        SELECT TOP (1)
          1 AS existe
        FROM Soporte.Usuario WITH (UPDLOCK, HOLDLOCK)
        WHERE Correo = @Correo;
      `);

      if (correoExistenteResult.recordset[0]) {
        throw new ConflictException('El correo ya se encuentra registrado.');
      }

      const idUsuario = randomUUID();
      const passwordHash = await bcrypt.hash(
        registerDto.password,
        this.passwordHashSaltRounds,
      );
      const usuario: AuthenticatedUser = {
        idUsuario,
        nombreCompleto: registerDto.nombreCompleto,
        correo: registerDto.correo,
      };
      const request = new sql.Request(transaction);

      this.addRegisterInputs(request, registerDto, idUsuario, passwordHash);

      await request.query(`
        INSERT INTO Soporte.Usuario (
          IdUsuario,
          NombreCompleto,
          Correo,
          PasswordHash,
          FotoPerfilUrl,
          Activo,
          FechaCreacion,
          FechaModificacion
        )
        VALUES (
          @IdUsuario,
          @NombreCompleto,
          @Correo,
          @PasswordHash,
          NULL,
          1,
          SYSDATETIME(),
          SYSDATETIME()
        );

        INSERT INTO Soporte.ConfiguracionUsuario (
          IdConfiguracion,
          IdUsuario,
          Pais,
          CodigoPais,
          MonedaPrincipal,
          ZonaHoraria,
          Tema,
          MostrarDecimales,
          PrimerDiaSemana,
          FechaCreacion,
          FechaModificacion
        )
        VALUES (
          NEWID(),
          @IdUsuario,
          @Pais,
          @CodigoPais,
          @MonedaPrincipal,
          @ZonaHoraria,
          @Tema,
          @MostrarDecimales,
          @PrimerDiaSemana,
          SYSDATETIME(),
          SYSDATETIME()
        );

        INSERT INTO Soporte.Auditoria (
          IdAuditoria,
          IdUsuario,
          Modulo,
          Accion,
          TablaAfectada,
          IdRegistroAfectado,
          Descripcion,
          ValorAnterior,
          ValorNuevo,
          FechaRegistro
        )
        VALUES (
          NEWID(),
          @IdUsuario,
          N'AUTH',
          N'REGISTER',
          N'Soporte.Usuario',
          CONVERT(nvarchar(100), @IdUsuario),
          N'Usuario registrado correctamente',
          NULL,
          NULL,
          SYSDATETIME()
        );
      `);

      await transaction.commit();

      return { usuario };
    } catch (error: unknown) {
      if (transaction) {
        await this.rollbackTransaction(transaction);
      }

      this.handleError(error, 'registrar usuario');
    }
  }

  async cambiarPassword(
    idUsuario: string,
    cambiarPasswordDto: CambiarPasswordDto,
  ): Promise<CambiarPasswordResponse> {
    try {
      this.validarPasswordDto(cambiarPasswordDto);

      const usuario = await this.buscarUsuarioPorId(idUsuario);

      if (!usuario) {
        throw new NotFoundException('No se encontro el usuario solicitado.');
      }

      if (!this.isUsuarioActivo(usuario.activo)) {
        throw new ForbiddenException('Usuario inactivo.');
      }

      const passwordActualValida = await this.compararPassword(
        cambiarPasswordDto.passwordActual,
        usuario.passwordHash,
      );

      if (!passwordActualValida) {
        throw new BadRequestException('La contraseña actual no es correcta.');
      }

      const passwordNuevaEsActual = await this.compararPassword(
        cambiarPasswordDto.passwordNueva,
        usuario.passwordHash,
      );

      if (passwordNuevaEsActual) {
        throw new BadRequestException(
          'La nueva password debe ser diferente a la actual.',
        );
      }

      const passwordHashNuevo = await bcrypt.hash(
        cambiarPasswordDto.passwordNueva,
        this.passwordHashSaltRounds,
      );
      const request = await this.databaseService.createRequest();

      request.input('Accion', sql.VarChar(30), 'CAMBIAR_PASSWORD');
      request.input('IdUsuario', sql.UniqueIdentifier, usuario.idUsuario);
      request.input('PasswordHashNuevo', sql.VarChar(255), passwordHashNuevo);

      await request.execute(this.usuarioStoredProcedureName);

      return {
        mensaje: 'Contraseña actualizada correctamente.',
      };
    } catch (error: unknown) {
      this.handleError(error, 'cambiar password');
    }
  }

  async consultarSesiones(
    idUsuario: string,
  ): Promise<ConsultarSesionesResponse> {
    try {
      const request = await this.databaseService.createRequest();

      request.input('Accion', sql.VarChar(30), 'CONSULTAR_SESIONES');
      request.input('IdUsuario', sql.UniqueIdentifier, idUsuario);

      const result = await request.execute<Record<string, unknown>>(
        this.usuarioStoredProcedureName,
      );

      return {
        sesiones: result.recordset ? [...result.recordset] : [],
      };
    } catch (error: unknown) {
      this.handleError(error, 'consultar sesiones');
    }
  }

  async cerrarSesiones(
    idUsuario: string,
    cerrarSesionesDto: CerrarSesionesDto,
  ): Promise<CerrarSesionesResponse> {
    try {
      const idSesiones = this.normalizarIdSesiones(
        cerrarSesionesDto.idSesiones,
      );
      const request = await this.databaseService.createRequest();

      request.input('Accion', sql.VarChar(30), 'CERRAR_SESIONES');
      request.input('IdUsuario', sql.UniqueIdentifier, idUsuario);
      request.input('IdSesiones', sql.VarChar(sql.MAX), idSesiones.join(','));

      await request.execute(this.usuarioStoredProcedureName);

      return {
        mensaje: 'Sesiones cerradas correctamente.',
      };
    } catch (error: unknown) {
      this.handleError(error, 'cerrar sesiones');
    }
  }

  async cerrarTodasSesiones(
    idUsuario: string,
  ): Promise<CerrarSesionesResponse> {
    try {
      const request = await this.databaseService.createRequest();

      request.input('Accion', sql.VarChar(30), 'CERRAR_TODAS_SESIONES');
      request.input('IdUsuario', sql.UniqueIdentifier, idUsuario);

      await request.execute(this.usuarioStoredProcedureName);

      return {
        mensaje: 'Sesiones cerradas correctamente.',
      };
    } catch (error: unknown) {
      this.handleError(error, 'cerrar todas las sesiones');
    }
  }

  me(usuario: AuthenticatedUser): AuthenticatedUser {
    return usuario;
  }

  private async buscarUsuarioPorCorreo(
    correo: string,
  ): Promise<UsuarioAutenticacionRow | null> {
    const request = await this.databaseService.createRequest();

    request.input('Correo', sql.NVarChar(150), correo);

    const result = await request.query<UsuarioAutenticacionRow>(`
      SELECT TOP (1)
        CONVERT(varchar(36), IdUsuario) AS idUsuario,
        NombreCompleto AS nombreCompleto,
        Correo AS correo,
        PasswordHash AS passwordHash,
        Activo AS activo
      FROM Soporte.Usuario
      WHERE Correo = @Correo;
    `);

    return result.recordset[0] ?? null;
  }

  private async buscarUsuarioPorId(
    idUsuario: string,
  ): Promise<UsuarioAutenticacionRow | null> {
    const request = await this.databaseService.createRequest();

    request.input('IdUsuario', sql.UniqueIdentifier, idUsuario);

    const result = await request.query<UsuarioAutenticacionRow>(`
      SELECT TOP (1)
        CONVERT(varchar(36), IdUsuario) AS idUsuario,
        NombreCompleto AS nombreCompleto,
        Correo AS correo,
        PasswordHash AS passwordHash,
        Activo AS activo
      FROM Soporte.Usuario
      WHERE IdUsuario = @IdUsuario;
    `);

    return result.recordset[0] ?? null;
  }

  private addRegisterInputs(
    request: sql.Request,
    registerDto: RegisterDto,
    idUsuario: string,
    passwordHash: string,
  ): void {
    request.input('IdUsuario', sql.UniqueIdentifier, idUsuario);
    request.input(
      'NombreCompleto',
      sql.NVarChar(150),
      registerDto.nombreCompleto,
    );
    request.input('Correo', sql.NVarChar(150), registerDto.correo);
    request.input('PasswordHash', sql.NVarChar(sql.MAX), passwordHash);
    request.input('Pais', sql.NVarChar(80), 'Ecuador');
    request.input('CodigoPais', sql.NVarChar(10), 'EC');
    request.input('MonedaPrincipal', sql.NVarChar(10), 'USD');
    request.input('ZonaHoraria', sql.NVarChar(100), 'America/Guayaquil');
    request.input('Tema', sql.NVarChar(20), 'claro');
    request.input('MostrarDecimales', sql.Bit, true);
    request.input('PrimerDiaSemana', sql.NVarChar(20), 'lunes');
  }

  private async compararPassword(
    password: string,
    passwordHash: string | null,
  ): Promise<boolean> {
    if (!passwordHash) {
      return false;
    }

    try {
      return await bcrypt.compare(password, passwordHash);
    } catch (error: unknown) {
      this.logger.warn(
        `PasswordHash invalido para bcrypt: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return false;
    }
  }

  private validarPasswordDto(cambiarPasswordDto: CambiarPasswordDto): void {
    const passwordActual = cambiarPasswordDto.passwordActual;
    const passwordNueva = cambiarPasswordDto.passwordNueva;
    const confirmarPasswordNueva = cambiarPasswordDto.confirmarPasswordNueva;

    if (
      this.isBlank(passwordActual) ||
      this.isBlank(passwordNueva) ||
      this.isBlank(confirmarPasswordNueva)
    ) {
      throw new BadRequestException('Las passwords no pueden estar vacias.');
    }

    if (passwordNueva !== confirmarPasswordNueva) {
      throw new BadRequestException(
        'passwordNueva y confirmarPasswordNueva deben coincidir.',
      );
    }

    if (passwordNueva.length < 8) {
      throw new BadRequestException(
        'La nueva password debe tener al menos 8 caracteres.',
      );
    }
  }

  private async registrarSesionYAuditoria(
    idUsuario: string,
    accessToken: string,
    metadata: LoginMetadata,
  ): Promise<void> {
    let transaction: sql.Transaction | null = null;

    try {
      const pool = await this.databaseService.getPool();
      transaction = new sql.Transaction(pool);

      await transaction.begin();

      const fechaInicio = new Date();
      const fechaExpiracion = this.getFechaExpiracionToken(
        accessToken,
        fechaInicio,
      );
      const tokenHash = await bcrypt.hash(
        accessToken,
        this.tokenHashSaltRounds,
      );
      const request = new sql.Request(transaction);

      request.input('IdUsuario', sql.UniqueIdentifier, idUsuario);
      request.input('TokenHash', sql.NVarChar(sql.MAX), tokenHash);
      request.input(
        'Dispositivo',
        sql.NVarChar(150),
        this.truncate(metadata.dispositivo, 150),
      );
      request.input('Ip', sql.NVarChar(50), this.truncate(metadata.ip, 50));
      request.input('FechaInicio', sql.DateTime2, fechaInicio);
      request.input('FechaExpiracion', sql.DateTime2, fechaExpiracion);

      await request.query(`
        INSERT INTO Soporte.Sesion (
          IdSesion,
          IdUsuario,
          TokenHash,
          Dispositivo,
          Ip,
          FechaInicio,
          FechaExpiracion,
          Activa
        )
        VALUES (
          NEWID(),
          @IdUsuario,
          @TokenHash,
          @Dispositivo,
          @Ip,
          @FechaInicio,
          @FechaExpiracion,
          1
        );

        INSERT INTO Soporte.Auditoria (
          IdAuditoria,
          IdUsuario,
          Modulo,
          Accion,
          TablaAfectada,
          IdRegistroAfectado,
          Descripcion,
          ValorAnterior,
          ValorNuevo,
          FechaRegistro
        )
        VALUES (
          NEWID(),
          @IdUsuario,
          N'AUTH',
          N'LOGIN',
          N'Soporte.Usuario',
          CONVERT(nvarchar(100), @IdUsuario),
          N'Inicio de sesion exitoso',
          NULL,
          NULL,
          SYSDATETIME()
        );
      `);

      await transaction.commit();
    } catch (error: unknown) {
      if (transaction) {
        await this.rollbackTransaction(transaction);
      }

      this.handleError(error, 'registrar la sesion');
    }
  }

  private getFechaExpiracionToken(accessToken: string, fallback: Date): Date {
    const decoded = this.jwtService.decode(accessToken) as {
      exp?: unknown;
    } | null;

    if (decoded && typeof decoded.exp === 'number') {
      return new Date(decoded.exp * 1000);
    }

    return new Date(fallback.getTime() + 60 * 60 * 1000);
  }

  private isUsuarioActivo(activo: boolean | number): boolean {
    return activo === true || activo === 1;
  }

  private truncate(
    value: string | undefined,
    maxLength: number,
  ): string | null {
    if (!value) {
      return null;
    }

    return value.slice(0, maxLength);
  }

  private isBlank(value: string): boolean {
    return value.trim().length === 0;
  }

  private normalizarIdSesiones(idSesiones: string[]): string[] {
    const idsNormalizados = idSesiones.map((idSesion) => idSesion.trim());

    if (idsNormalizados.some((idSesion) => this.isBlank(idSesion))) {
      throw new BadRequestException('No se permiten sesiones vacias.');
    }

    return [...new Set(idsNormalizados)];
  }

  private async rollbackTransaction(
    transaction: sql.Transaction,
  ): Promise<void> {
    try {
      await transaction.rollback();
    } catch (rollbackError: unknown) {
      this.logger.warn(
        `No fue posible revertir la transaccion de auth: ${
          rollbackError instanceof Error
            ? rollbackError.message
            : String(rollbackError)
        }`,
      );
    }
  }

  private handleError(contextError: unknown, action: string): never {
    if (contextError instanceof HttpException) {
      throw contextError;
    }

    this.logger.error(
      `Error al ${action}.`,
      contextError instanceof Error ? contextError.stack : String(contextError),
    );
    throw new InternalServerErrorException(
      'No fue posible procesar la autenticacion.',
    );
  }
}
