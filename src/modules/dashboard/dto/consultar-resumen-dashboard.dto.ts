import { IsDateString, IsOptional } from 'class-validator';

export class ConsultarResumenDashboardDto {
  @IsOptional()
  @IsDateString()
  fechaInicio?: string;

  @IsOptional()
  @IsDateString()
  fechaFin?: string;
}
