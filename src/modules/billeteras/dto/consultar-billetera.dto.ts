import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';

const toOptionalBoolean = ({ value }: { value: unknown }): unknown => {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

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

export class ConsultarBilleteraDto {
  @IsOptional()
  @Transform(toOptionalBoolean)
  @IsBoolean()
  activo?: boolean;
}
