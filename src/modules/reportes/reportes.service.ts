import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import * as sql from 'mssql';
import { join } from 'node:path';
import pdfMake from 'pdfmake';
import type {
  Content,
  TableCell,
  TDocumentDefinitions,
  TFontDictionary,
} from 'pdfmake/interfaces';

import { DatabaseService } from '../../database/database.service';
import {
  ConsultarReporteDto,
  TipoMovimientoReporte,
} from './dto/consultar-reporte.dto';

type ReporteAccion = 'CONSULTAR_RESUMEN' | 'CONSULTAR_MOVIMIENTOS';

interface FiltrosReporteAplicados {
  fechaInicio: string;
  fechaFin: string;
  idBilletera: number | null;
  tipoMovimiento: TipoMovimientoReporte | null;
}

interface ResumenReporte {
  totalIngresos: number;
  totalGastos: number;
  balance: number;
  cantidadMovimientos: number;
}

interface MovimientoReporte {
  idMovimiento: number | null;
  fechaMovimiento: string | null;
  tipoMovimiento: string | null;
  categoria: string | null;
  billetera: string | null;
  titulo: string | null;
  descripcion: string | null;
  cuentaOrigen: string | null;
  cuentaDestino: string | null;
  monto: number;
}

export interface ResumenReporteResponse {
  filtros: FiltrosReporteAplicados;
  resumen: ResumenReporte;
}

export interface MovimientosReporteResponse {
  filtros: FiltrosReporteAplicados;
  movimientos: MovimientoReporte[];
  total: number;
}

export interface ReportePdfResponse {
  buffer: Buffer;
  filename: string;
}

@Injectable()
export class ReportesService {
  private readonly logger = new Logger(ReportesService.name);
  private readonly storedProcedureName = 'Finanzas.SP_Reporte';

  constructor(private readonly databaseService: DatabaseService) {
    this.configurePdfFonts();
  }

  async consultarResumen(
    idUsuario: string,
    filtrosDto: ConsultarReporteDto,
  ): Promise<ResumenReporteResponse> {
    const filtros = this.resolveFiltros(filtrosDto);
    const request = await this.createReporteRequest(
      'CONSULTAR_RESUMEN',
      idUsuario,
      filtros,
    );
    const result = await this.execute(request, 'CONSULTAR_RESUMEN');

    return {
      filtros,
      resumen: this.toResumenReporte(result.recordset?.[0]),
    };
  }

  async consultarMovimientos(
    idUsuario: string,
    filtrosDto: ConsultarReporteDto,
  ): Promise<MovimientosReporteResponse> {
    const filtros = this.resolveFiltros(filtrosDto);
    const request = await this.createReporteRequest(
      'CONSULTAR_MOVIMIENTOS',
      idUsuario,
      filtros,
    );
    const result = await this.execute(request, 'CONSULTAR_MOVIMIENTOS');
    const movimientos = (result.recordset ?? []).map((record) =>
      this.toMovimientoReporte(record),
    );

    return {
      filtros,
      movimientos,
      total: movimientos.length,
    };
  }

  async exportarPdf(
    idUsuario: string,
    filtrosDto: ConsultarReporteDto,
  ): Promise<ReportePdfResponse> {
    const [resumenResponse, movimientosResponse] = await Promise.all([
      this.consultarResumen(idUsuario, filtrosDto),
      this.consultarMovimientos(idUsuario, filtrosDto),
    ]);

    try {
      const buffer = await this.createPdfBuffer(
        resumenResponse.filtros,
        resumenResponse.resumen,
        movimientosResponse.movimientos,
      );

      return {
        buffer,
        filename: this.createPdfFilename(resumenResponse.filtros),
      };
    } catch (error: unknown) {
      this.logger.error(
        'Error generating reportes PDF',
        error instanceof Error ? error.stack : String(error),
      );
      throw new InternalServerErrorException(
        'No fue posible generar el reporte PDF.',
      );
    }
  }

  private configurePdfFonts(): void {
    const robotoPath = join(
      process.cwd(),
      'node_modules',
      'pdfmake',
      'fonts',
      'Roboto',
    );
    const fonts: TFontDictionary = {
      Roboto: {
        normal: join(robotoPath, 'Roboto-Regular.ttf'),
        bold: join(robotoPath, 'Roboto-Medium.ttf'),
        italics: join(robotoPath, 'Roboto-Italic.ttf'),
        bolditalics: join(robotoPath, 'Roboto-MediumItalic.ttf'),
      },
    };

    pdfMake.setUrlAccessPolicy(() => false);
    pdfMake.setLocalAccessPolicy((filePath) =>
      filePath.toLowerCase().startsWith(robotoPath.toLowerCase()),
    );
    pdfMake.setFonts(fonts);
  }

  private async createPdfBuffer(
    filtros: FiltrosReporteAplicados,
    resumen: ResumenReporte,
    movimientos: MovimientoReporte[],
  ): Promise<Buffer> {
    const documentDefinition = this.createPdfDocumentDefinition(
      filtros,
      resumen,
      movimientos,
    );

    return pdfMake.createPdf(documentDefinition).getBuffer();
  }

  private createPdfDocumentDefinition(
    filtros: FiltrosReporteAplicados,
    resumen: ResumenReporte,
    movimientos: MovimientoReporte[],
  ): TDocumentDefinitions {
    const content: Content[] = [
      { text: 'TRAYECTORIA', style: 'brand' },
      { text: 'Reporte de Movimientos', style: 'title' },
      {
        table: {
          widths: ['auto', '*', 'auto', '*'],
          body: [
            [
              this.createLabelCell('Periodo'),
              this.createValueCell(
                `${this.formatDisplayDate(filtros.fechaInicio)} - ${this.formatDisplayDate(
                  filtros.fechaFin,
                )}`,
              ),
              this.createLabelCell('Fecha de generacion'),
              this.createValueCell(this.formatGeneratedAt(new Date())),
            ],
            [
              this.createLabelCell('Billetera'),
              this.createValueCell(this.resolveBilleteraLabel(filtros, movimientos)),
              this.createLabelCell('Tipo'),
              this.createValueCell(filtros.tipoMovimiento ?? 'Todos'),
            ],
          ],
        },
        layout: 'noBorders',
        margin: [0, 0, 0, 18],
      },
      { text: 'Resumen del periodo', style: 'sectionTitle' },
      this.createResumenTable(resumen),
      { text: 'Detalle de movimientos', style: 'sectionTitle' },
      ...this.createMovimientosContent(movimientos),
    ];

    return {
      pageSize: 'A4',
      pageOrientation: 'landscape',
      pageMargins: [28, 30, 28, 30],
      content,
      defaultStyle: {
        font: 'Roboto',
        fontSize: 8,
      },
      styles: {
        brand: {
          fontSize: 16,
          bold: true,
          color: '#1f2937',
          margin: [0, 0, 0, 2],
        },
        title: {
          fontSize: 12,
          bold: true,
          color: '#374151',
          margin: [0, 0, 0, 12],
        },
        sectionTitle: {
          fontSize: 10,
          bold: true,
          color: '#111827',
          margin: [0, 10, 0, 6],
        },
        label: {
          bold: true,
          color: '#374151',
        },
        muted: {
          color: '#6b7280',
        },
        tableHeader: {
          bold: true,
          color: '#ffffff',
          fillColor: '#1f2937',
        },
      },
      footer: (currentPage, pageCount) => ({
        text: `Pagina ${currentPage} de ${pageCount}`,
        alignment: 'right',
        margin: [0, 8, 28, 0],
        fontSize: 7,
        color: '#6b7280',
      }),
      info: {
        title: 'Reporte de Movimientos',
        author: 'Trayectoria',
        subject: 'Reporte de movimientos financieros',
      },
    };
  }

  private createResumenTable(resumen: ResumenReporte): Content {
    return {
      table: {
        headerRows: 1,
        widths: ['*', 110],
        body: [
          [
            this.createHeaderCell('Concepto'),
            this.createHeaderCell('Valor', 'right'),
          ],
          [
            this.createValueCell('Ingresos'),
            this.createValueCell(this.formatAmount(resumen.totalIngresos), 'right'),
          ],
          [
            this.createValueCell('Gastos'),
            this.createValueCell(this.formatAmount(resumen.totalGastos), 'right'),
          ],
          [
            this.createValueCell('Balance'),
            this.createValueCell(this.formatAmount(resumen.balance), 'right'),
          ],
          [
            this.createValueCell('Movimientos'),
            this.createValueCell(String(resumen.cantidadMovimientos), 'right'),
          ],
        ],
      },
      layout: 'lightHorizontalLines',
      margin: [0, 0, 0, 10],
    };
  }

  private createMovimientosContent(
    movimientos: MovimientoReporte[],
  ): Content[] {
    if (movimientos.length === 0) {
      return [
        {
          text: 'No hay movimientos para el periodo seleccionado.',
          style: 'muted',
          margin: [0, 2, 0, 0],
        },
      ];
    }

    return [
      {
        table: {
          headerRows: 1,
          widths: [52, 58, 72, 76, 100, '*', 62],
          body: [
            [
              this.createHeaderCell('Fecha'),
              this.createHeaderCell('Tipo'),
              this.createHeaderCell('Categoria'),
              this.createHeaderCell('Billetera'),
              this.createHeaderCell('Titulo'),
              this.createHeaderCell('Descripcion'),
              this.createHeaderCell('Monto', 'right'),
            ],
            ...movimientos.map((movimiento) =>
              this.createMovimientoRow(movimiento),
            ),
          ],
        },
        layout: 'lightHorizontalLines',
      },
    ];
  }

  private createMovimientoRow(movimiento: MovimientoReporte): TableCell[] {
    return [
      this.createValueCell(this.formatDisplayDate(movimiento.fechaMovimiento)),
      this.createValueCell(movimiento.tipoMovimiento ?? '-'),
      this.createValueCell(movimiento.categoria ?? '-'),
      this.createValueCell(movimiento.billetera ?? '-'),
      this.createValueCell(movimiento.titulo ?? '-'),
      this.createValueCell(this.formatDescripcionMovimiento(movimiento)),
      this.createValueCell(this.formatAmount(movimiento.monto), 'right'),
    ];
  }

  private createLabelCell(text: string): TableCell {
    return this.createValueCell(text, undefined, 'label');
  }

  private createHeaderCell(
    text: string,
    alignment?: 'left' | 'right' | 'center',
  ): TableCell {
    return this.createValueCell(text, alignment, 'tableHeader');
  }

  private createValueCell(
    text: string,
    alignment?: 'left' | 'right' | 'center',
    style?: string,
  ): TableCell {
    return {
      text,
      alignment,
      style,
      margin: [2, 4, 2, 4],
    } as TableCell;
  }

  private resolveBilleteraLabel(
    filtros: FiltrosReporteAplicados,
    movimientos: MovimientoReporte[],
  ): string {
    if (!filtros.idBilletera) {
      return 'Todas';
    }

    const billetera = movimientos.find((movimiento) => movimiento.billetera)
      ?.billetera;

    return billetera ?? `Billetera ${filtros.idBilletera}`;
  }

  private formatDescripcionMovimiento(movimiento: MovimientoReporte): string {
    const lines = [movimiento.descripcion?.trim()].filter(
      (value): value is string => Boolean(value),
    );

    if (movimiento.tipoMovimiento === 'TRANSFERENCIA') {
      if (movimiento.cuentaOrigen) {
        lines.push(`Origen: ${movimiento.cuentaOrigen}`);
      }

      if (movimiento.cuentaDestino) {
        lines.push(`Destino: ${movimiento.cuentaDestino}`);
      }
    }

    return lines.length > 0 ? lines.join('\n') : '-';
  }

  private formatAmount(value: number): string {
    return new Intl.NumberFormat('es-EC', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  }

  private formatDisplayDate(value: string | null): string {
    if (!value) {
      return '-';
    }

    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);

    if (match) {
      return `${match[3]}/${match[2]}/${match[1]}`;
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return '-';
    }

    return this.formatDisplayDate(this.formatDate(date));
  }

  private formatGeneratedAt(date: Date): string {
    const pad = (value: number): string => value.toString().padStart(2, '0');

    return `${pad(date.getDate())}/${pad(
      date.getMonth() + 1,
    )}/${date.getFullYear()} ${pad(date.getHours())}:${pad(
      date.getMinutes(),
    )}`;
  }

  private createPdfFilename(filtros: FiltrosReporteAplicados): string {
    const month = filtros.fechaInicio.slice(0, 7);

    return `reporte-movimientos-${month}.pdf`;
  }

  private async createReporteRequest(
    accion: ReporteAccion,
    idUsuario: string,
    filtros: FiltrosReporteAplicados,
  ): Promise<sql.Request> {
    const request = await this.databaseService.createRequest();

    request.input('Accion', sql.VarChar(30), accion);
    request.input('IdUsuario', sql.UniqueIdentifier, idUsuario);
    request.input('FechaInicio', sql.Date, this.toSqlDate(filtros.fechaInicio));
    request.input('FechaFin', sql.Date, this.toSqlDate(filtros.fechaFin));
    request.input('IdBilletera', sql.Int, filtros.idBilletera);
    request.input('TipoMovimiento', sql.VarChar(20), filtros.tipoMovimiento);

    return request;
  }

  private async execute(
    request: sql.Request,
    accion: ReporteAccion,
  ): Promise<sql.IProcedureResult<Record<string, unknown>>> {
    try {
      return await request.execute(this.storedProcedureName);
    } catch (error: unknown) {
      this.logger.error(
        `Error executing ${this.storedProcedureName} with action ${accion}`,
        error instanceof Error ? error.stack : String(error),
      );
      throw new InternalServerErrorException(
        'No fue posible consultar los reportes.',
      );
    }
  }

  private resolveFiltros(
    filtrosDto: ConsultarReporteDto,
  ): FiltrosReporteAplicados {
    const rango = this.resolveRangoFechas(filtrosDto);

    return {
      fechaInicio: this.formatDate(rango.fechaInicio),
      fechaFin: this.formatDate(rango.fechaFin),
      idBilletera: filtrosDto.idBilletera ?? null,
      tipoMovimiento: filtrosDto.tipoMovimiento ?? null,
    };
  }

  private resolveRangoFechas(filtrosDto: ConsultarReporteDto): {
    fechaInicio: Date;
    fechaFin: Date;
  } {
    if (!filtrosDto.fechaInicio && !filtrosDto.fechaFin) {
      return this.getCurrentMonthRange();
    }

    if (filtrosDto.fechaInicio && filtrosDto.fechaFin) {
      const fechaInicio = this.parseDate(filtrosDto.fechaInicio);
      const fechaFin = this.parseDate(filtrosDto.fechaFin);
      this.validateDateRange(fechaInicio, fechaFin);

      return { fechaInicio, fechaFin };
    }

    const fechaReferencia = this.parseDate(
      filtrosDto.fechaInicio ?? filtrosDto.fechaFin ?? '',
    );

    return filtrosDto.fechaInicio
      ? {
          fechaInicio: fechaReferencia,
          fechaFin: this.getLastDayOfMonth(fechaReferencia),
        }
      : {
          fechaInicio: this.getFirstDayOfMonth(fechaReferencia),
          fechaFin: fechaReferencia,
        };
  }

  private validateDateRange(fechaInicio: Date, fechaFin: Date): void {
    if (fechaInicio.getTime() > fechaFin.getTime()) {
      throw new BadRequestException(
        'fechaInicio no puede ser mayor que fechaFin.',
      );
    }
  }

  private getCurrentMonthRange(): { fechaInicio: Date; fechaFin: Date } {
    const now = new Date();

    return {
      fechaInicio: this.getFirstDayOfMonth(now),
      fechaFin: this.getLastDayOfMonth(now),
    };
  }

  private getFirstDayOfMonth(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), 1);
  }

  private getLastDayOfMonth(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0);
  }

  private parseDate(value: string): Date {
    const dateOnlyPattern = /^\d{4}-\d{2}-\d{2}$/;

    if (dateOnlyPattern.test(value)) {
      const [year, month, day] = value.split('-').map(Number);
      return new Date(year, month - 1, day);
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException('Las fechas enviadas no son validas.');
    }

    return date;
  }

  private toSqlDate(value: string): Date {
    return this.parseDate(value);
  }

  private formatDate(date: Date): string {
    const pad = (value: number): string => value.toString().padStart(2, '0');

    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
      date.getDate(),
    )}`;
  }

  private toResumenReporte(
    record?: Record<string, unknown>,
  ): ResumenReporte {
    if (!record) {
      return {
        totalIngresos: 0,
        totalGastos: 0,
        balance: 0,
        cantidadMovimientos: 0,
      };
    }

    return {
      totalIngresos: this.getNumber(record, [
        'totalIngresos',
        'TotalIngresos',
        'TOTALINGRESOS',
      ]),
      totalGastos: this.getNumber(record, [
        'totalGastos',
        'TotalGastos',
        'TOTALGASTOS',
      ]),
      balance: this.getNumber(record, ['balance', 'Balance', 'BALANCE']),
      cantidadMovimientos: this.getNumber(record, [
        'cantidadMovimientos',
        'CantidadMovimientos',
        'CANTIDADMOVIMIENTOS',
      ]),
    };
  }

  private toMovimientoReporte(
    record: Record<string, unknown>,
  ): MovimientoReporte {
    return {
      idMovimiento: this.getNullableNumber(record, [
        'idMovimiento',
        'IdMovimiento',
        'IDMOVIMIENTO',
      ]),
      fechaMovimiento: this.getIsoDate(record, [
        'fechaMovimiento',
        'FechaMovimiento',
        'FECHAMOVIMIENTO',
      ]),
      tipoMovimiento: this.getNullableUpperText(record, [
        'tipoMovimiento',
        'TipoMovimiento',
        'TIPOMOVIMIENTO',
      ]),
      categoria: this.getNullableText(record, [
        'categoria',
        'Categoria',
        'CATEGORIA',
        'nombreCategoria',
        'NombreCategoria',
        'NOMBRECATEGORIA',
      ]),
      billetera: this.getNullableText(record, [
        'billetera',
        'Billetera',
        'BILLETERA',
        'nombreBilletera',
        'NombreBilletera',
        'NOMBREBILLETERA',
      ]),
      titulo: this.getNullableText(record, ['titulo', 'Titulo', 'TITULO']),
      descripcion: this.getNullableText(record, [
        'descripcion',
        'Descripcion',
        'DESCRIPCION',
      ]),
      cuentaOrigen: this.getNullableText(record, [
        'cuentaOrigen',
        'CuentaOrigen',
        'CUENTAORIGEN',
      ]),
      cuentaDestino: this.getNullableText(record, [
        'cuentaDestino',
        'CuentaDestino',
        'CUENTADESTINO',
      ]),
      monto: this.getNumber(record, ['monto', 'Monto', 'MONTO']),
    };
  }

  private getNullableText(
    record: Record<string, unknown>,
    keys: string[],
  ): string | null {
    const value = this.getValue(record, keys);

    return value === undefined || value === null ? null : String(value);
  }

  private getNullableUpperText(
    record: Record<string, unknown>,
    keys: string[],
  ): string | null {
    const value = this.getNullableText(record, keys);

    return value ? value.toUpperCase() : value;
  }

  private getNumber(record: Record<string, unknown>, keys: string[]): number {
    return this.getNullableNumber(record, keys) ?? 0;
  }

  private getNullableNumber(
    record: Record<string, unknown>,
    keys: string[],
  ): number | null {
    const value = this.getValue(record, keys);

    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === 'string') {
      const parsedValue = Number(value);
      return Number.isFinite(parsedValue) ? parsedValue : null;
    }

    return null;
  }

  private getIsoDate(
    record: Record<string, unknown>,
    keys: string[],
  ): string | null {
    const value = this.getValue(record, keys);

    if (value instanceof Date) {
      return Number.isNaN(value.getTime()) ? null : value.toISOString();
    }

    if (typeof value !== 'string' && typeof value !== 'number') {
      return null;
    }

    const date = new Date(value);

    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }

  private getValue(record: Record<string, unknown>, keys: string[]): unknown {
    return keys.map((key) => record[key]).find((value) => value !== undefined);
  }
}
