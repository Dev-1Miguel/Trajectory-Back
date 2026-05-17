import { IsDateString, IsOptional, IsString } from 'class-validator';

export class ConsultarMovimientoDto {
  @IsOptional()
  @IsString()
  tipoMovimiento?: string;

  @IsOptional()
  @IsDateString()
  fechaInicio?: string;

  @IsOptional()
  @IsDateString()
  fechaFin?: string;
}
