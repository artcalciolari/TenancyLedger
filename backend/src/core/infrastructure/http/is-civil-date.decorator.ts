import { ValidateBy, buildMessage, type ValidationOptions } from 'class-validator';
import { isCivilDate } from '../../domain/calendar-period';

export const IS_CIVIL_DATE = 'isCivilDate';

export function IsCivilDate(validationOptions?: ValidationOptions): PropertyDecorator {
  return ValidateBy(
    {
      name: IS_CIVIL_DATE,
      validator: {
        validate: (value: unknown) => isCivilDate(value),
        defaultMessage: buildMessage(
          (eachPrefix) =>
            `${eachPrefix}$property deve ser uma data válida no formato AAAA-MM-DD`,
          validationOptions,
        ),
      },
    },
    validationOptions,
  );
}
