import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import * as sql from 'mssql/msnodesqlv8';

import { DatabaseService } from '../../database/database.service';
import { ActualizarMovimientoDto } from './dto/actualizar-movimiento.dto';
import { ConsultarMovimientoDto } from './dto/consultar-movimiento.dto';
import { CrearMovimientoDto } from './dto/crear-movimiento.dto';

type MovimientoAccion = 'CREAR' | 'CONSULTAR' | 'ACTUALIZAR';

export interface StoredProcedureResponse<T = Record<string, unknown>> {
  data: T[];
  rowsAffected: number[];
  output: Record<string, unknown>;
}

@Injectable()
export class MovimientosService {
  private readonly logger = new Logger(MovimientosService.name);
  private readonly storedProcedureName = 'Finanzas.SP_Movimiento';

  constructor(private readonly databaseService: DatabaseService) {}

  async crear(
    crearMovimientoDto: CrearMovimientoDto,
  ): Promise<StoredProcedureResponse> {
    const request = await this.databaseService.createRequest();

    this.addActionInput(request, 'CREAR');
    this.addMovimientoInputs(request, crearMovimientoDto);

    return this.execute(request, 'CREAR');
  }

  async consultar(
    filtros: ConsultarMovimientoDto,
  ): Promise<StoredProcedureResponse> {
    const request = await this.databaseService.createRequest();

    this.addActionInput(request, 'CONSULTAR');
    request.input(
      'TipoMovimiento',
      sql.NVarChar(50),
      filtros.tipoMovimiento ?? null,
    );
    request.input(
      'FechaInicio',
      sql.DateTime2,
      this.toDateOrNull(filtros.fechaInicio),
    );
    request.input(
      'FechaFin',
      sql.DateTime2,
      this.toDateOrNull(filtros.fechaFin),
    );

    return this.execute(request, 'CONSULTAR');
  }

  async actualizar(
    id: number,
    actualizarMovimientoDto: ActualizarMovimientoDto,
  ): Promise<StoredProcedureResponse> {
    const request = await this.databaseService.createRequest();

    this.addActionInput(request, 'ACTUALIZAR');
    request.input('IdMovimiento', sql.Int, id);
    this.addMovimientoInputs(request, actualizarMovimientoDto);

    return this.execute(request, 'ACTUALIZAR');
  }

  private addActionInput(request: sql.Request, accion: MovimientoAccion): void {
    request.input('Accion', sql.VarChar(20), accion);
  }

  private addMovimientoInputs(
    request: sql.Request,
    movimientoDto: CrearMovimientoDto | ActualizarMovimientoDto,
  ): void {
    request.input(
      'TipoMovimiento',
      sql.NVarChar(50),
      movimientoDto.tipoMovimiento,
    );
    request.input('Titulo', sql.NVarChar(150), movimientoDto.titulo);
    request.input(
      'Descripcion',
      sql.NVarChar(sql.MAX),
      movimientoDto.descripcion ?? null,
    );
    request.input('Monto', sql.Decimal(18, 2), movimientoDto.monto);
    request.input(
      'CuentaOrigen',
      sql.NVarChar(100),
      movimientoDto.cuentaOrigen ?? null,
    );
    request.input(
      'CuentaDestino',
      sql.NVarChar(100),
      movimientoDto.cuentaDestino ?? null,
    );
    request.input(
      'FechaMovimiento',
      sql.DateTime2,
      this.toDateOrNull(movimientoDto.fechaMovimiento),
    );
  }

  private async execute(
    request: sql.Request,
    accion: MovimientoAccion,
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
        'No fue posible ejecutar la operacion de movimientos.',
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

  private toDateOrNull(value?: string): Date | null {
    return value ? new Date(value) : null;
  }
}
