import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import * as sql from 'mssql';

import { DatabaseService } from '../../database/database.service';
import { ActualizarCategoriaDto } from './dto/actualizar-categoria.dto';
import { CambiarEstadoCategoriaDto } from './dto/cambiar-estado-categoria.dto';
import { ConsultarCategoriaDto } from './dto/consultar-categoria.dto';
import { CrearCategoriaDto } from './dto/crear-categoria.dto';

type CategoriaAccion = 'CREAR' | 'CONSULTAR' | 'ACTUALIZAR' | 'CAMBIAR_ESTADO';

export interface StoredProcedureResponse<T = Record<string, unknown>> {
  data: T[];
  rowsAffected: number[];
  output: Record<string, unknown>;
}

@Injectable()
export class CategoriasService {
  private readonly logger = new Logger(CategoriasService.name);
  private readonly storedProcedureName = 'Finanzas.SP_Categoria';

  constructor(private readonly databaseService: DatabaseService) {}

  async crear(
    crearCategoriaDto: CrearCategoriaDto,
  ): Promise<StoredProcedureResponse> {
    const request = await this.databaseService.createRequest();

    this.addActionInput(request, 'CREAR');
    this.addCategoriaInputs(request, crearCategoriaDto);

    return this.execute(request, 'CREAR');
  }

  async consultar(
    filtros: ConsultarCategoriaDto,
  ): Promise<StoredProcedureResponse> {
    const request = await this.databaseService.createRequest();

    this.addActionInput(request, 'CONSULTAR');
    request.input('Activo', sql.Bit, filtros.activo ?? null);

    return this.execute(request, 'CONSULTAR');
  }

  async actualizar(
    id: number,
    actualizarCategoriaDto: ActualizarCategoriaDto,
  ): Promise<StoredProcedureResponse> {
    const request = await this.databaseService.createRequest();

    this.addActionInput(request, 'ACTUALIZAR');
    request.input('IdCategoria', sql.Int, id);
    this.addCategoriaInputs(request, actualizarCategoriaDto);

    return this.execute(request, 'ACTUALIZAR');
  }

  async cambiarEstado(
    id: number,
    cambiarEstadoCategoriaDto: CambiarEstadoCategoriaDto,
  ): Promise<StoredProcedureResponse> {
    const request = await this.databaseService.createRequest();

    this.addActionInput(request, 'CAMBIAR_ESTADO');
    request.input('IdCategoria', sql.Int, id);
    request.input('Activo', sql.Bit, cambiarEstadoCategoriaDto.activo);

    return this.execute(request, 'CAMBIAR_ESTADO');
  }

  private addActionInput(request: sql.Request, accion: CategoriaAccion): void {
    request.input('Accion', sql.VarChar(20), accion);
  }

  private addCategoriaInputs(
    request: sql.Request,
    categoriaDto: CrearCategoriaDto | ActualizarCategoriaDto,
  ): void {
    request.input('Nombre', sql.NVarChar(100), categoriaDto.nombre);
    request.input(
      'TipoMovimiento',
      sql.NVarChar(20),
      categoriaDto.tipoMovimiento,
    );
  }

  private async execute(
    request: sql.Request,
    accion: CategoriaAccion,
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
        'No fue posible ejecutar la operacion de categorias.',
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
