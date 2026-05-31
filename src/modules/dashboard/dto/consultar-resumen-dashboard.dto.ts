import { Type } from 'class-transformer';
import { IsDateString, IsInt, IsOptional, IsPositive } from 'class-validator';

export class ConsultarResumenDashboardDto {
  @IsOptional()
  @IsDateString()
  fechaInicio?: string;

  @IsOptional()
  @IsDateString()
  fechaFin?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  idBilletera?: number | null;
}
