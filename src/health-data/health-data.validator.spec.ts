import { validateHealthSubmission } from './health-data.validator';
import { SubmitHealthDataDto } from './dto/submit-health-data.dto';

describe('health data validation', () => {
  it('rejects duplicate dates and inconsistent day counts', () => {
    const dto = validDto();
    dto.dailyHealthData[1].date = dto.dailyHealthData[0].date;
    dto.dataContext.daysAvailable = 3;
    const errors = validateHealthSubmission(dto);
    expect(errors.some((error) => error.message.includes('duplicate'))).toBe(true);
    expect(errors.some((error) => error.field === 'dataContext.daysAvailable')).toBe(true);
  });

  it('rejects payloads where every day has all availability flags false', () => {
    const dto = validDto();
    dto.dailyHealthData = dto.dailyHealthData.map((day) => ({
      ...day,
      steps: 0,
      distanceMeters: 0,
      activeCalories: 0,
      restingHeartRate: null,
      averageHeartRate: null,
      sleepMinutes: null,
      dataAvailability: {
        steps: false,
        distance: false,
        activeCalories: false,
        restingHeartRate: false,
        averageHeartRate: false,
        sleep: false,
      },
    }));
    const errors = validateHealthSubmission(dto);
    expect(errors.some((error) => error.field === 'dailyHealthData')).toBe(true);
  });
});

function validDto(): SubmitHealthDataDto {
  return {
    schemaVersion: '1.0',
    userContext: {
      wellnessUserId: 'wu_recovery_001',
      propertyId: 'property_001',
      appVersion: '1.0.0',
      platform: 'ANDROID',
      timezone: 'Asia/Kolkata',
    },
    dataContext: {
      generatedAt: '2026-09-29T10:30:00+05:30',
      dataFrom: '2026-09-23',
      dataTo: '2026-09-25',
      daysAvailable: 2,
    },
    dailyHealthData: [
      record('2026-09-23'),
      record('2026-09-24'),
    ],
  };
}

function record(date: string) {
  return {
    date,
    steps: 8000,
    distanceMeters: 5000,
    activeCalories: 400,
    restingHeartRate: 62,
    averageHeartRate: 75,
    sleepMinutes: 420,
    dataAvailability: {
      steps: true,
      distance: true,
      activeCalories: true,
      restingHeartRate: true,
      averageHeartRate: true,
      sleep: true,
    },
  };
}
