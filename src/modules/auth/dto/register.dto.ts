import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsNotEmpty,
  IsString,
  MaxLength,
  Validate,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

const trimString = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

@ValidatorConstraint({ name: 'passwordsMatch', async: false })
class PasswordsMatchConstraint implements ValidatorConstraintInterface {
  validate(confirmarPassword: unknown, args: ValidationArguments): boolean {
    const registerDto = args.object as RegisterDto;

    return (
      typeof confirmarPassword === 'string' &&
      confirmarPassword === registerDto.password
    );
  }

  defaultMessage(): string {
    return 'password y confirmarPassword deben coincidir.';
  }
}

export class RegisterDto {
  @Transform(trimString)
  @IsNotEmpty()
  @IsString()
  @MaxLength(150)
  nombreCompleto: string;

  @Transform(trimString)
  @IsNotEmpty()
  @IsEmail()
  @MaxLength(150)
  correo: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  password: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  @Validate(PasswordsMatchConstraint)
  confirmarPassword: string;
}
