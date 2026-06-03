import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsNotEmpty,
  IsString,
  Length,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

const trimString = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class ResetPasswordDto {
  @Transform(trimString)
  @IsEmail()
  @MaxLength(150)
  correo: string;

  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @Length(6, 6)
  @Matches(/^\d{6}$/, {
    message: 'codigo debe contener 6 digitos.',
  })
  codigo: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  @MaxLength(200)
  passwordNueva: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  confirmarPasswordNueva: string;
}
