import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsString, MaxLength } from 'class-validator';

const trimString = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class LoginDto {
  @Transform(trimString)
  @IsEmail()
  @MaxLength(150)
  correo: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  password: string;
}
