import {
  IsNotEmpty,
  IsString,
  MaxLength,
  MinLength,
  Validate,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

@ValidatorConstraint({ name: 'passwordsNuevasMatch', async: false })
class PasswordsNuevasMatchConstraint
  implements ValidatorConstraintInterface
{
  validate(
    confirmarPasswordNueva: unknown,
    args: ValidationArguments,
  ): boolean {
    const cambiarPasswordDto = args.object as CambiarPasswordDto;

    return (
      typeof confirmarPasswordNueva === 'string' &&
      confirmarPasswordNueva === cambiarPasswordDto.passwordNueva
    );
  }

  defaultMessage(): string {
    return 'passwordNueva y confirmarPasswordNueva deben coincidir.';
  }
}

export class CambiarPasswordDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  passwordActual: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  @MaxLength(200)
  passwordNueva: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  @Validate(PasswordsNuevasMatchConstraint)
  confirmarPasswordNueva: string;
}
