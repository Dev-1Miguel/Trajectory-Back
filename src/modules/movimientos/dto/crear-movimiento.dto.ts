import { Type } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';

export class CrearMovimientoDto {
  @IsNotEmpty()
  @IsString()
  tipoMovimiento: string;

  @IsNotEmpty()
  @IsString()
  titulo: string;

  @IsOptional()
  @IsString()
  descripcion?: string;

  @Type(() => Number)
  @IsNumber({ allowInfinity: false, allowNaN: false, maxDecimalPlaces: 2 })
  monto: number;

  @IsOptional()
  @IsString()
  cuentaOrigen?: string;

  @IsOptional()
  @IsString()
  cuentaDestino?: string;

  @IsOptional()
  @IsDateString()
  fechaMovimiento?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  idCategoria?: number | null;
}
