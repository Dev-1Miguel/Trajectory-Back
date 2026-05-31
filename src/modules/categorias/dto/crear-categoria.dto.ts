import { IsIn, IsNotEmpty, IsString } from 'class-validator';

export class CrearCategoriaDto {
  @IsNotEmpty()
  @IsString()
  nombre: string;

  @IsNotEmpty()
  @IsString()
  @IsIn(['Ingreso', 'Gasto'])
  tipoMovimiento: string;
}
