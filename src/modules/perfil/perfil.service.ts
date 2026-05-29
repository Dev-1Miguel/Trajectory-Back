import {
  HttpException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import * as sql from 'mssql/msnodesqlv8';

import { DatabaseService } from '../../database/database.service';
import { ActualizarInformacionPersonalDto } from './dto/actualizar-informacion-personal.dto';

export interface InformacionPersonal {
  idUsuario: string;
  nombreCompleto: string;
  correo: string;
  fotoPerfilUrl: string | null;
  pais: string | null;
  codigoPais: string | null;
  monedaPrincipal: string | null;
  zonaHoraria: string | null;
}

@Injectable()
export class PerfilService {
  private readonly logger = new Logger(PerfilService.name);

  constructor(private readonly databaseService: DatabaseService) {}

  async obtenerInformacionPersonal(
    idUsuario: string,
  ): Promise<InformacionPersonal> {
    try {
      const request = await this.databaseService.createRequest();

      request.input('IdUsuario', sql.UniqueIdentifier, idUsuario);

      const result = await request.query<InformacionPersonal>(`
        SELECT
          CONVERT(varchar(36), u.IdUsuario) AS idUsuario,
          u.NombreCompleto AS nombreCompleto,
          u.Correo AS correo,
          u.FotoPerfilUrl AS fotoPerfilUrl,
          cu.Pais AS pais,
          cu.CodigoPais AS codigoPais,
          cu.MonedaPrincipal AS monedaPrincipal,
          cu.ZonaHoraria AS zonaHoraria
        FROM Soporte.Usuario AS u
        LEFT JOIN Soporte.ConfiguracionUsuario AS cu
          ON cu.IdUsuario = u.IdUsuario
        WHERE u.IdUsuario = @IdUsuario;
      `);

      const informacionPersonal = result.recordset[0];

      if (!informacionPersonal) {
        throw new NotFoundException('No se encontro el usuario solicitado.');
      }

      return informacionPersonal;
    } catch (error: unknown) {
      this.handleError(error, 'obtener la informacion personal');
    }
  }

  async actualizarInformacionPersonal(
    idUsuario: string,
    actualizarInformacionPersonalDto: ActualizarInformacionPersonalDto,
  ): Promise<InformacionPersonal> {
    let transaction: sql.Transaction | null = null;

    try {
      const pool = await this.databaseService.getPool();
      transaction = new sql.Transaction(pool);

      await transaction.begin();

      const request = new sql.Request(transaction);
      this.addInformacionPersonalInputs(
        request,
        actualizarInformacionPersonalDto,
        idUsuario,
      );

      const result = await request.query<InformacionPersonal>(`
        UPDATE Soporte.Usuario
        SET
          NombreCompleto = @NombreCompleto,
          FotoPerfilUrl = COALESCE(@FotoPerfilUrl, FotoPerfilUrl),
          FechaModificacion = SYSDATETIME()
        WHERE IdUsuario = @IdUsuario;

        IF @@ROWCOUNT = 0
        BEGIN
          THROW 51000, 'USUARIO_NO_ENCONTRADO', 1;
        END;

        IF EXISTS (
          SELECT 1
          FROM Soporte.ConfiguracionUsuario
          WHERE IdUsuario = @IdUsuario
        )
        BEGIN
          UPDATE Soporte.ConfiguracionUsuario
          SET
            Pais = @Pais,
            CodigoPais = @CodigoPais,
            MonedaPrincipal = @MonedaPrincipal,
            ZonaHoraria = @ZonaHoraria,
            FechaModificacion = SYSDATETIME()
          WHERE IdUsuario = @IdUsuario;
        END
        ELSE
        BEGIN
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
            FechaCreacion
          )
          VALUES (
            NEWID(),
            @IdUsuario,
            @Pais,
            @CodigoPais,
            @MonedaPrincipal,
            @ZonaHoraria,
            N'claro',
            1,
            N'lunes',
            SYSDATETIME()
          );
        END;

        SELECT
          CONVERT(varchar(36), u.IdUsuario) AS idUsuario,
          u.NombreCompleto AS nombreCompleto,
          u.Correo AS correo,
          u.FotoPerfilUrl AS fotoPerfilUrl,
          cu.Pais AS pais,
          cu.CodigoPais AS codigoPais,
          cu.MonedaPrincipal AS monedaPrincipal,
          cu.ZonaHoraria AS zonaHoraria
        FROM Soporte.Usuario AS u
        LEFT JOIN Soporte.ConfiguracionUsuario AS cu
          ON cu.IdUsuario = u.IdUsuario
        WHERE u.IdUsuario = @IdUsuario;
      `);

      const informacionPersonal = result.recordset[0];

      if (!informacionPersonal) {
        throw new NotFoundException('No se encontro el usuario solicitado.');
      }

      await transaction.commit();

      return informacionPersonal;
    } catch (error: unknown) {
      if (transaction) {
        await this.rollbackTransaction(transaction);
      }

      if (
        error instanceof Error &&
        error.message.includes('USUARIO_NO_ENCONTRADO')
      ) {
        throw new NotFoundException('No se encontro el usuario solicitado.');
      }

      this.handleError(error, 'actualizar la informacion personal');
    }
  }

  private addInformacionPersonalInputs(
    request: sql.Request,
    informacionPersonal: ActualizarInformacionPersonalDto,
    idUsuario: string,
  ): void {
    request.input('IdUsuario', sql.UniqueIdentifier, idUsuario);
    request.input(
      'NombreCompleto',
      sql.NVarChar(150),
      informacionPersonal.nombreCompleto,
    );
    request.input(
      'FotoPerfilUrl',
      sql.NVarChar(300),
      informacionPersonal.fotoPerfilUrl ?? null,
    );
    request.input('Pais', sql.NVarChar(80), informacionPersonal.pais);
    request.input(
      'CodigoPais',
      sql.NVarChar(10),
      informacionPersonal.codigoPais,
    );
    request.input(
      'MonedaPrincipal',
      sql.NVarChar(10),
      informacionPersonal.monedaPrincipal,
    );
    request.input(
      'ZonaHoraria',
      sql.NVarChar(100),
      informacionPersonal.zonaHoraria,
    );
  }

  private async rollbackTransaction(
    transaction: sql.Transaction,
  ): Promise<void> {
    try {
      await transaction.rollback();
    } catch (rollbackError: unknown) {
      this.logger.warn(
        `No fue posible revertir la transaccion de perfil: ${
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
      'No fue posible procesar la informacion personal.',
    );
  }
}
