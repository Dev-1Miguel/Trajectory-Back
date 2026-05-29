import { Transform } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

const trimString = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class ActualizarInformacionPersonalDto {
  @Transform(trimString)
  @IsNotEmpty()
  @IsString()
  @MaxLength(150)
  nombreCompleto: string;

  @Transform(trimString)
  @IsOptional()
  @IsString()
  @MaxLength(300)
  fotoPerfilUrl?: string;

  @Transform(trimString)
  @IsNotEmpty()
  @IsString()
  @MaxLength(80)
  pais: string;

  @Transform(trimString)
  @IsNotEmpty()
  @IsString()
  @MaxLength(10)
  codigoPais: string;

  @Transform(trimString)
  @IsNotEmpty()
  @IsString()
  @MaxLength(10)
  monedaPrincipal: string;

  @Transform(trimString)
  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  zonaHoraria: string;
}
