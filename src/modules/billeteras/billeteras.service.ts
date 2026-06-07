import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import * as sql from 'mssql';

import { DatabaseService } from '../../database/database.service';
import { ActualizarBilleteraDto } from './dto/actualizar-billetera.dto';
import { CambiarEstadoBilleteraDto } from './dto/cambiar-estado-billetera.dto';
import { ConsultarBilleteraDto } from './dto/consultar-billetera.dto';
import { CrearBilleteraDto } from './dto/crear-billetera.dto';

type BilleteraAccion =
  | 'CREAR'
  | 'CONSULTAR'
  | 'ACTUALIZAR'
  | 'CAMBIAR_ESTADO'
  | 'MARCAR_PRINCIPAL';

export interface StoredProcedureResponse<T = Record<string, unknown>> {
  data: T[];
  rowsAffected: number[];
  output: Record<string, unknown>;
}

@Injectable()
export class BilleterasService {
  private readonly logger = new Logger(BilleterasService.name);
  private readonly storedProcedureName = 'Finanzas.SP_Billetera';

  constructor(private readonly databaseService: DatabaseService) {}

  async crear(
    idUsuario: string,
    crearBilleteraDto: CrearBilleteraDto,
  ): Promise<StoredProcedureResponse> {
    const request = await this.databaseService.createRequest();

    this.addActionInput(request, 'CREAR');
    request.input('IdUsuario', sql.UniqueIdentifier, idUsuario);
    this.addBilleteraInputs(request, crearBilleteraDto);

    return this.execute(request, 'CREAR');
  }

  async consultar(
    idUsuario: string,
    filtros: ConsultarBilleteraDto,
  ): Promise<StoredProcedureResponse> {
    const request = await this.databaseService.createRequest();

    this.addActionInput(request, 'CONSULTAR');
    request.input('IdUsuario', sql.UniqueIdentifier, idUsuario);
    request.input('Activo', sql.Bit, filtros.activo ?? null);

    return this.execute(request, 'CONSULTAR');
  }

  async actualizar(
    id: number,
    idUsuario: string,
    actualizarBilleteraDto: ActualizarBilleteraDto,
  ): Promise<StoredProcedureResponse> {
    const request = await this.databaseService.createRequest();

    this.addActionInput(request, 'ACTUALIZAR');
    request.input('IdBilletera', sql.Int, id);
    request.input('IdUsuario', sql.UniqueIdentifier, idUsuario);
    this.addBilleteraInputs(request, actualizarBilleteraDto);

    return this.execute(request, 'ACTUALIZAR');
  }

  async cambiarEstado(
    id: number,
    idUsuario: string,
    cambiarEstadoBilleteraDto: CambiarEstadoBilleteraDto,
  ): Promise<StoredProcedureResponse> {
    const request = await this.databaseService.createRequest();

    this.addActionInput(request, 'CAMBIAR_ESTADO');
    request.input('IdBilletera', sql.Int, id);
    request.input('IdUsuario', sql.UniqueIdentifier, idUsuario);
    request.input('Activo', sql.Bit, cambiarEstadoBilleteraDto.activo);

    return this.execute(request, 'CAMBIAR_ESTADO');
  }

  async marcarPrincipal(
    id: number,
    idUsuario: string,
  ): Promise<StoredProcedureResponse> {
    const request = await this.databaseService.createRequest();

    this.addActionInput(request, 'MARCAR_PRINCIPAL');
    request.input('IdBilletera', sql.Int, id);
    request.input('IdUsuario', sql.UniqueIdentifier, idUsuario);

    return this.execute(request, 'MARCAR_PRINCIPAL');
  }

  private addActionInput(request: sql.Request, accion: BilleteraAccion): void {
    request.input('Accion', sql.VarChar(20), accion);
  }

  private addBilleteraInputs(
    request: sql.Request,
    billeteraDto: CrearBilleteraDto | ActualizarBilleteraDto,
  ): void {
    request.input('Nombre', sql.NVarChar(100), billeteraDto.nombre);
    request.input(
      'Descripcion',
      sql.NVarChar(200),
      billeteraDto.descripcion ?? null,
    );
    request.input('EsPrincipal', sql.Bit, billeteraDto.esPrincipal ?? false);
  }

  private async execute(
    request: sql.Request,
    accion: BilleteraAccion,
  ): Promise<StoredProcedureResponse> {
    try {
      const result = await request.execute(this.storedProcedureName);
      return this.formatResult(result);
    } catch (error: unknown) {
      this.logger.error(
        `Error executing ${this.storedProcedureName} with action ${accion}`,
        error instanceof Error ? error.stack : String(error),
      );
      throw new InternalServerErrorException(
        'No fue posible ejecutar la operacion de billeteras.',
      );
    }
  }

  private formatResult(
    result: sql.IProcedureResult<Record<string, unknown>>,
  ): StoredProcedureResponse {
    return {
      data: result.recordset ? [...result.recordset] : [],
      rowsAffected: result.rowsAffected ?? [],
      output: result.output ?? {},
    };
  }
}
