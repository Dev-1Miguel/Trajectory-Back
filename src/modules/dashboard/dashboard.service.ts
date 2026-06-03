import { BadRequestException, Injectable } from '@nestjs/common';

import { MovimientosService } from '../movimientos/movimientos.service';
import { ConsultarResumenDashboardDto } from './dto/consultar-resumen-dashboard.dto';

type TipoMovimientoResumen = 'ingreso' | 'gasto' | 'transferencia';
type EcuadorDatePart = 'year' | 'month' | 'day' | 'hour' | 'minute' | 'second';

const ECUADOR_TIME_ZONE = 'America/Guayaquil';

interface MovimientoDashboard {
  idMovimiento?: number;
  tipoMovimiento: string;
  titulo: string;
  descripcion?: string;
  nombreCategoria?: string | null;
  monto: number;
  cuentaOrigen?: string;
  cuentaDestino?: string;
  fechaMovimiento?: string;
}

export interface GastoPorTituloDashboard {
  titulo: string;
  total: number;
}

export interface ResumenDashboard {
  totalIngresos: number;
  totalGastos: number;
  balance: number;
  cantidadMovimientos: number;
  ultimosMovimientos: MovimientoDashboard[];
  resumenPorTipo: Record<TipoMovimientoResumen, number>;
  gastosPorTitulo: GastoPorTituloDashboard[];
}

interface DateRange {
  inicio: Date;
  fin: Date;
}

@Injectable()
export class DashboardService {
  private readonly ultimosMovimientosLimit = 5;
  private readonly gastosPorTituloLimit = 4;

  constructor(private readonly movimientosService: MovimientosService) {}

  async obtenerResumen(
    idUsuario: string,
    filtros: ConsultarResumenDashboardDto,
  ): Promise<ResumenDashboard> {
    const rango = this.resolveDateRange(filtros);
    const response = await this.movimientosService.consultar(
      idUsuario,
      {
        fechaInicio: this.formatDateTime(rango.inicio),
        fechaFin: this.formatDateTime(rango.fin),
        idBilletera: filtros.idBilletera,
      },
    );

    const movimientos = response.data
      .map((record) => this.toMovimientoDashboard(record))
      .filter(
        (movimiento): movimiento is MovimientoDashboard =>
          movimiento !== null,
      );
    const resumenPorTipo: Record<TipoMovimientoResumen, number> = {
      ingreso: 0,
      gasto: 0,
      transferencia: 0,
    };

    movimientos.forEach((movimiento) => {
      const tipo = this.normalizeTipoMovimiento(movimiento.tipoMovimiento);

      if (!tipo) {
        return;
      }

      resumenPorTipo[tipo] += Math.abs(movimiento.monto);
    });

    const resumenRedondeado = {
      ingreso: this.roundCurrency(resumenPorTipo.ingreso),
      gasto: this.roundCurrency(resumenPorTipo.gasto),
      transferencia: this.roundCurrency(resumenPorTipo.transferencia),
    };

    return {
      totalIngresos: resumenRedondeado.ingreso,
      totalGastos: resumenRedondeado.gasto,
      balance: this.roundCurrency(
        resumenRedondeado.ingreso - resumenRedondeado.gasto,
      ),
      cantidadMovimientos: movimientos.length,
      ultimosMovimientos: this.getUltimosMovimientos(movimientos),
      resumenPorTipo: resumenRedondeado,
      gastosPorTitulo: this.getGastosPorTitulo(movimientos),
    };
  }

  private resolveDateRange(filtros: ConsultarResumenDashboardDto): DateRange {
    const defaultRange = this.getCurrentMonthRange();
    const inicio = filtros.fechaInicio
      ? this.parseDate(filtros.fechaInicio)
      : defaultRange.inicio;
    const fin = filtros.fechaFin
      ? this.parseDate(filtros.fechaFin, true)
      : defaultRange.fin;

    if (inicio.getTime() > fin.getTime()) {
      throw new BadRequestException(
        'fechaInicio no puede ser mayor que fechaFin.',
      );
    }

    return { inicio, fin };
  }

  private getCurrentMonthRange(): DateRange {
    const nowParts = this.getEcuadorDateParts(new Date());
    const year = Number(nowParts.year);
    const month = Number(nowParts.month);
    const inicio = new Date(year, month - 1, 1, 0, 0, 0, 0);
    const fin = new Date(
      year,
      month,
      0,
      23,
      59,
      59,
      999,
    );

    return { inicio, fin };
  }

  private parseDate(value: string, endOfDay = false): Date {
    const dateOnlyPattern = /^\d{4}-\d{2}-\d{2}$/;

    if (dateOnlyPattern.test(value)) {
      const [year, month, day] = value.split('-').map(Number);

      return new Date(
        year,
        month - 1,
        day,
        endOfDay ? 23 : 0,
        endOfDay ? 59 : 0,
        endOfDay ? 59 : 0,
        endOfDay ? 999 : 0,
      );
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException('Las fechas enviadas no son validas.');
    }

    return date;
  }

  private toMovimientoDashboard(
    record: Record<string, unknown>,
  ): MovimientoDashboard | null {
    const tipoMovimiento = this.getText(record, [
      'tipoMovimiento',
      'TipoMovimiento',
      'TIPOMOVIMIENTO',
    ]);
    const monto = this.getNumber(record, ['monto', 'Monto', 'MONTO']);
    const fechaMovimiento = this.getDate(record, [
      'fechaMovimiento',
      'FechaMovimiento',
      'FECHAMOVIMIENTO',
    ]);
    const titulo = this.getText(record, [
      'titulo',
      'Titulo',
      'TITULO',
      'nombre',
      'Nombre',
    ]);

    if (!tipoMovimiento && monto === undefined && !fechaMovimiento && !titulo) {
      return null;
    }

    return {
      idMovimiento: this.getNumber(record, [
        'idMovimiento',
        'IdMovimiento',
        'IDMOVIMIENTO',
        'id',
      ]),
      tipoMovimiento: tipoMovimiento ?? 'Movimiento',
      titulo: titulo ?? 'Movimiento',
      descripcion: this.getText(record, [
        'descripcion',
        'Descripcion',
        'DESCRIPCION',
      ]),
      nombreCategoria: this.getText(record, [
        'nombreCategoria',
        'NombreCategoria',
        'NOMBRECATEGORIA',
      ]),
      monto: monto ?? 0,
      cuentaOrigen: this.getText(record, [
        'cuentaOrigen',
        'CuentaOrigen',
        'CUENTAORIGEN',
      ]),
      cuentaDestino: this.getText(record, [
        'cuentaDestino',
        'CuentaDestino',
        'CUENTADESTINO',
      ]),
      fechaMovimiento: fechaMovimiento
        ? this.formatEcuadorDateTimeWithOffset(fechaMovimiento)
        : undefined,
    };
  }

  private getUltimosMovimientos(
    movimientos: MovimientoDashboard[],
  ): MovimientoDashboard[] {
    return [...movimientos]
      .sort(
        (left, right) =>
          this.getTimestamp(right.fechaMovimiento) -
          this.getTimestamp(left.fechaMovimiento),
      )
      .slice(0, this.ultimosMovimientosLimit);
  }

  private getGastosPorTitulo(
    movimientos: MovimientoDashboard[],
  ): GastoPorTituloDashboard[] {
    const totalsByCategory = new Map<string, GastoPorTituloDashboard>();

    movimientos.forEach((movimiento) => {
      if (this.normalizeTipoMovimiento(movimiento.tipoMovimiento) !== 'gasto') {
        return;
      }

      const titulo = this.normalizeGastoTitulo(movimiento);
      const groupKey = this.getGroupKey(titulo);
      const currentGroup = totalsByCategory.get(groupKey) ?? {
        titulo,
        total: 0,
      };

      totalsByCategory.set(groupKey, {
        titulo: currentGroup.titulo,
        total: this.roundCurrency(
          currentGroup.total + Math.abs(movimiento.monto),
        ),
      });
    });

    return Array.from(totalsByCategory.values())
      .sort((left, right) => right.total - left.total)
      .slice(0, this.gastosPorTituloLimit);
  }

  private normalizeGastoTitulo(movimiento: MovimientoDashboard): string {
    const normalizedCategory = movimiento.nombreCategoria?.trim();

    if (normalizedCategory && normalizedCategory.length > 0) {
      return normalizedCategory;
    }

    return this.normalizeTituloMovimiento(
      movimiento.titulo,
      movimiento.descripcion,
    );
  }

  private normalizeTituloMovimiento(titulo?: string, descripcion?: string): string {
    const normalizedTitle = titulo?.trim();
    const normalizedDescription = descripcion?.trim();

    if (normalizedTitle && normalizedTitle.length > 0) {
      return normalizedTitle;
    }

    return normalizedDescription && normalizedDescription.length > 0
      ? normalizedDescription
      : 'Sin categoría';
  }

  private getGroupKey(value: string): string {
    return value
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  private normalizeTipoMovimiento(
    value: string,
  ): TipoMovimientoResumen | null {
    const normalizedValue = value
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

    if (normalizedValue.includes('ingreso') || normalizedValue.includes('income')) {
      return 'ingreso';
    }

    if (normalizedValue.includes('gasto') || normalizedValue.includes('expense')) {
      return 'gasto';
    }

    if (
      normalizedValue.includes('transferencia') ||
      normalizedValue.includes('transfer')
    ) {
      return 'transferencia';
    }

    return null;
  }

  private getText(
    record: Record<string, unknown>,
    keys: string[],
  ): string | undefined {
    const value = this.getValue(record, keys);

    if (value === undefined || value === null) {
      return undefined;
    }

    return String(value);
  }

  private getNumber(
    record: Record<string, unknown>,
    keys: string[],
  ): number | undefined {
    const value = this.getValue(record, keys);

    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === 'string') {
      const parsedValue = Number(value);
      return Number.isFinite(parsedValue) ? parsedValue : undefined;
    }

    return undefined;
  }

  private getDate(
    record: Record<string, unknown>,
    keys: string[],
  ): Date | undefined {
    const value = this.getValue(record, keys);

    if (value instanceof Date) {
      return Number.isNaN(value.getTime()) ? undefined : value;
    }

    if (typeof value !== 'string' && typeof value !== 'number') {
      return undefined;
    }

    const date = new Date(value);

    return Number.isNaN(date.getTime()) ? undefined : date;
  }

  private getValue(record: Record<string, unknown>, keys: string[]): unknown {
    return keys.map((key) => record[key]).find((value) => value !== undefined);
  }

  private getTimestamp(value?: string): number {
    if (!value) {
      return 0;
    }

    const timestamp = new Date(value).getTime();

    return Number.isNaN(timestamp) ? 0 : timestamp;
  }

  private formatDateTime(date: Date): string {
    const pad = (value: number, size = 2): string =>
      value.toString().padStart(size, '0');

    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
      date.getDate(),
    )}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(
      date.getSeconds(),
    )}.${pad(date.getMilliseconds(), 3)}`;
  }

  private formatEcuadorDateTimeWithOffset(date: Date): string {
    const parts = this.getEcuadorDateParts(date);

    return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}-05:00`;
  }

  private getEcuadorDateParts(date: Date): Record<EcuadorDatePart, string> {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: ECUADOR_TIME_ZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
      hourCycle: 'h23',
    });

    return formatter.formatToParts(date).reduce(
      (parts, part) => {
        if (part.type in parts) {
          parts[part.type as EcuadorDatePart] = part.value;
        }

        return parts;
      },
      {
        year: '',
        month: '',
        day: '',
        hour: '',
        minute: '',
        second: '',
      },
    );
  }

  private roundCurrency(value: number): number {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }
}
