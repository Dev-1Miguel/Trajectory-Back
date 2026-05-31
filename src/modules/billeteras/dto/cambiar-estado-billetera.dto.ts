import { Transform } from 'class-transformer';
import { IsBoolean } from 'class-validator';

const toBoolean = ({ value }: { value: unknown }): unknown => {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    const normalizedValue = value.trim().toLowerCase();

    if (normalizedValue === 'true' || normalizedValue === '1') {
      return true;
    }

    if (normalizedValue === 'false' || normalizedValue === '0') {
      return false;
    }
  }

  return value;
};

export class CambiarEstadoBilleteraDto {
  @Transform(toBoolean)
  @IsBoolean()
  activo: boolean;
}
