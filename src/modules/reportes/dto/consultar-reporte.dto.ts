import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsPositive,
  Validate,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

export type TipoMovimientoReporte = 'INGRESO' | 'GASTO' | 'TRANSFERENCIA';

const emptyToUndefined = ({ value }: { value: unknown }): unknown =>
  value === '' || value === null ? undefined : value;

const toUppercaseOptional = ({ value }: { value: unknown }): unknown => {
  if (value === '' || value === null || value === undefined) {
    return undefined;
  }

  return typeof value === 'string' ? value.trim().toUpperCase() : value;
};

const toOptionalNumber = ({ value }: { value: unknown }): unknown => {
  if (value === '' || value === null || value === undefined) {
    return undefined;
  }

  return typeof value === 'number' ? value : Number(value);
};

@ValidatorConstraint({ name: 'FechaRangoReporte', async: false })
class FechaRangoReporteConstraint implements ValidatorConstraintInterface {
  validate(_value: unknown, args: ValidationArguments): boolean {
    const filtros = args.object as ConsultarReporteDto;

    if (!filtros.fechaInicio || !filtros.fechaFin) {
      return true;
    }

    const fechaInicio = new Date(filtros.fechaInicio);
    const fechaFin = new Date(filtros.fechaFin);

    if (
      Number.isNaN(fechaInicio.getTime()) ||
      Number.isNaN(fechaFin.getTime())
    ) {
      return true;
    }

    return fechaInicio.getTime() <= fechaFin.getTime();
  }

  defaultMessage(): string {
    return 'fechaInicio no puede ser mayor que fechaFin.';
  }
}

export class ConsultarReporteDto {
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsDateString()
  fechaInicio?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsDateString()
  @Validate(FechaRangoReporteConstraint)
  fechaFin?: string;

  @IsOptional()
  @Transform(toOptionalNumber)
  @IsInt()
  @IsPositive()
  idBilletera?: number;

  @IsOptional()
  @Transform(toUppercaseOptional)
  @IsIn(['INGRESO', 'GASTO', 'TRANSFERENCIA'])
  tipoMovimiento?: TipoMovimientoReporte;
}
