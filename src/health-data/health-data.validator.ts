import { inclusiveDayCount, isIsoDate } from '../common/dates';
import { isValidTimeZone } from '../common/timezone';
import { SubmitHealthDataDto } from './dto/submit-health-data.dto';

export interface FieldError {
  field: string;
  message: string;
}

export function validateHealthSubmission(dto: SubmitHealthDataDto): FieldError[] {
  const errors: FieldError[] = [];
  const { dataContext, userContext, dailyHealthData } = dto;

  if (!isValidTimeZone(userContext.timezone)) {
    errors.push({ field: 'userContext.timezone', message: 'timezone must be a valid IANA timezone' });
  }
  if (!isIsoDate(dataContext.dataFrom)) {
    errors.push({ field: 'dataContext.dataFrom', message: 'dataFrom must be a real calendar date' });
  }
  if (!isIsoDate(dataContext.dataTo)) {
    errors.push({ field: 'dataContext.dataTo', message: 'dataTo must be a real calendar date' });
  }
  if (Number.isNaN(Date.parse(dataContext.generatedAt))) {
    errors.push({ field: 'dataContext.generatedAt', message: 'generatedAt must be a valid timestamp' });
  }
  if (errors.length > 0) {
    return errors;
  }

  if (dataContext.dataFrom > dataContext.dataTo) {
    errors.push({ field: 'dataContext.dataFrom', message: 'dataFrom must be on or before dataTo' });
  }
  if (dataContext.daysAvailable !== dailyHealthData.length) {
    errors.push({
      field: 'dataContext.daysAvailable',
      message: 'daysAvailable must match the number of daily records',
    });
  }
  const span = inclusiveDayCount(dataContext.dataFrom, dataContext.dataTo);
  if (dailyHealthData.length > span) {
    errors.push({
      field: 'dailyHealthData',
      message: 'daily records exceed the dataFrom and dataTo window',
    });
  }

  const seen = new Set<string>();
  dailyHealthData.forEach((day, index) => {
    if (!isIsoDate(day.date)) {
      errors.push({ field: `dailyHealthData[${index}].date`, message: 'date must be a real calendar date' });
      return;
    }
    if (seen.has(day.date)) {
      errors.push({ field: `dailyHealthData[${index}].date`, message: 'duplicate date' });
    }
    seen.add(day.date);
    if (day.date < dataContext.dataFrom || day.date > dataContext.dataTo) {
      errors.push({
        field: `dailyHealthData[${index}].date`,
        message: 'date is outside dataFrom and dataTo',
      });
    }
    requireWhenAvailable(errors, index, 'restingHeartRate', day.dataAvailability.restingHeartRate, day.restingHeartRate);
    requireWhenAvailable(errors, index, 'averageHeartRate', day.dataAvailability.averageHeartRate, day.averageHeartRate);
    requireWhenAvailable(errors, index, 'sleepMinutes', day.dataAvailability.sleep, day.sleepMinutes);
  });

  return errors;
}

function requireWhenAvailable(
  errors: FieldError[],
  index: number,
  field: string,
  available: boolean,
  value: number | null | undefined,
): void {
  if (available && (value === null || value === undefined)) {
    errors.push({
      field: `dailyHealthData[${index}].${field}`,
      message: `${field} is marked available but no value was provided`,
    });
  }
}
