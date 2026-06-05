import { Transform } from 'class-transformer';
import { IsEmail, MaxLength } from 'class-validator';

const trimString = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class TestEmailDto {
  @Transform(trimString)
  @IsEmail()
  @MaxLength(150)
  correo: string;
}
