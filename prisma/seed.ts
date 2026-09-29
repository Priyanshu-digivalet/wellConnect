import { PrismaClient, Prisma } from '@prisma/client';
import { addDays } from '../src/common/dates';

const prisma = new PrismaClient();

const PROPERTY_ID = 'property_001';
const END_DATE = '2026-09-29';

async function main(): Promise<void> {
  const property = await prisma.property.upsert({
    where: { propertyId: PROPERTY_ID },
    update: { name: 'WellConnect Residences', timezone: 'Asia/Kolkata', enabled: true },
    create: {
      propertyId: PROPERTY_ID,
      name: 'WellConnect Residences',
      timezone: 'Asia/Kolkata',
      enabled: true,
    },
  });

  const features = [
    feature('facility_gym', 'GYM', 'Gym', 'FITNESS', 'app://facility/gym', ['fitness', 'activity'], null, null),
    feature('facility_pool', 'POOL', 'Swimming Pool', 'FITNESS', 'app://facility/pool', ['fitness', 'recovery'], null, null),
    feature('service_spa', 'SPA', 'Spa', 'WELLNESS', 'app://service/spa', ['recovery', 'relaxation'], 'spa', null),
    feature('outlet_restaurant', 'RESTAURANT', 'Restaurant', 'DINING', 'app://outlet/restaurant', ['dining'], null, 'restaurant'),
  ];

  for (const item of features) {
    await prisma.propertyFeature.upsert({
      where: { propertyId_featureId: { propertyId: property.propertyId, featureId: item.featureId } },
      update: item,
      create: { propertyId: property.propertyId, ...item },
    });
  }

  await seedResident({
    wellnessUserId: 'wu_recovery_001',
    steps: [9800, 10200, 8900, 11000, 9600, 10400, 8700],
    sleep: [340, 360, 330, 350, 370, 345, 355],
    heart: [66, 67, 65, 68, 66, 67, 64],
  });
  await seedResident({
    wellnessUserId: 'wu_low_activity_001',
    steps: [2800, 3200, 2500, 3100, 2900, 3400, 2700],
    sleep: [450, 470, 440, 460, 455, 480, 445],
    heart: [60, 61, 59, 62, 60, 61, 58],
  });
  await seedResident({
    wellnessUserId: 'wu_active_001',
    steps: [8600, 9100, 8800, 9400, 8700, 9200, 9000],
    sleep: [450, 460, 470, 440, 455, 465, 450],
    heart: [58, 59, 57, 60, 58, 59, 57],
  });

  console.log('Seeded property_001 with gym, pool, spa, restaurant, and 3 synthetic residents.');
}

function feature(
  featureId: string,
  featureType: string,
  name: string,
  category: string,
  deepLink: string,
  tags: string[],
  serviceId: string | null,
  outletId: string | null,
) {
  return {
    featureId,
    featureType,
    name,
    category,
    serviceId,
    outletId,
    enabled: true,
    available: true,
    deepLink,
    tags,
  };
}

async function seedResident(input: {
  wellnessUserId: string;
  steps: number[];
  sleep: number[];
  heart: number[];
}): Promise<void> {
  await prisma.wellnessUser.upsert({
    where: { wellnessUserId: input.wellnessUserId },
    update: {
      propertyId: PROPERTY_ID,
      timezone: 'Asia/Kolkata',
      platform: 'ANDROID',
      appVersion: '1.0.0',
    },
    create: {
      wellnessUserId: input.wellnessUserId,
      propertyId: PROPERTY_ID,
      timezone: 'Asia/Kolkata',
      platform: 'ANDROID',
      appVersion: '1.0.0',
    },
  });

  await prisma.notificationDevice.upsert({
    where: {
      wellnessUserId_deviceId: {
        wellnessUserId: input.wellnessUserId,
        deviceId: `device-${input.wellnessUserId}`,
      },
    },
    update: {
      platform: 'ANDROID',
      fcmToken: `synthetic-fcm-${input.wellnessUserId}`,
      appVersion: '1.0.0',
      notificationsEnabled: true,
      lastSeenAt: new Date('2026-09-29T05:00:00.000Z'),
    },
    create: {
      wellnessUserId: input.wellnessUserId,
      deviceId: `device-${input.wellnessUserId}`,
      platform: 'ANDROID',
      fcmToken: `synthetic-fcm-${input.wellnessUserId}`,
      appVersion: '1.0.0',
      notificationsEnabled: true,
      lastSeenAt: new Date('2026-09-29T05:00:00.000Z'),
    },
  });

  const start = addDays(END_DATE, -(input.steps.length - 1));
  for (let index = 0; index < input.steps.length; index += 1) {
    const date = new Date(`${addDays(start, index)}T00:00:00.000Z`);
    const steps = input.steps[index];
    const sleepMinutes = input.sleep[index];
    const restingHeartRate = input.heart[index];
    const availability = {
      steps: true,
      distance: true,
      activeCalories: true,
      restingHeartRate: true,
      averageHeartRate: true,
      sleep: true,
    };
    const data = {
      steps,
      distanceMeters: Math.round(steps * 0.75),
      activeCalories: Math.round(steps * 0.05),
      restingHeartRate,
      averageHeartRate: restingHeartRate + 14,
      sleepMinutes,
      dataAvailability: availability as Prisma.InputJsonValue,
      dataQuality: 1,
    };
    await prisma.dailyHealthData.upsert({
      where: { wellnessUserId_date: { wellnessUserId: input.wellnessUserId, date } },
      update: data,
      create: { wellnessUserId: input.wellnessUserId, date, ...data },
    });
  }
}

main()
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : 'seed_failed';
    console.error(message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
