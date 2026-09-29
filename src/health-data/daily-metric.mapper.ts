import { Prisma } from '@prisma/client';
import { DailyMetric } from '../analytics/analytics.types';
import { DataAvailabilityDto } from './dto/submit-health-data.dto';

export function toDailyMetric(day: {
  date: Date;
  steps: number;
  distanceMeters: number;
  activeCalories: number;
  restingHeartRate: number | null;
  averageHeartRate: number | null;
  sleepMinutes: number | null;
  dataAvailability: Prisma.JsonValue;
}): DailyMetric {
  const availability = (day.dataAvailability ?? {}) as Partial<DataAvailabilityDto>;
  return {
    date: day.date.toISOString().slice(0, 10),
    steps: day.steps,
    distanceMeters: day.distanceMeters,
    activeCalories: day.activeCalories,
    restingHeartRate: day.restingHeartRate,
    averageHeartRate: day.averageHeartRate,
    sleepMinutes: day.sleepMinutes,
    dataAvailability: {
      steps: Boolean(availability.steps),
      distance: Boolean(availability.distance),
      activeCalories: Boolean(availability.activeCalories),
      restingHeartRate: Boolean(availability.restingHeartRate),
      averageHeartRate: Boolean(availability.averageHeartRate),
      sleep: Boolean(availability.sleep),
    },
  };
}
