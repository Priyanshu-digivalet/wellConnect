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

  // Catalog types: FACILITY / SERVICE / OUTLET (plus legacy GYM/POOL/SPA/RESTAURANT aliases kept
  // via dual rows only where needed — primary rows use the mobile catalog shape).
  const features = [
    feature({
      featureId: 'facility_gym',
      featureType: 'FACILITY',
      name: 'Gym',
      category: 'FITNESS',
      deepLink: 'app://facility/gym',
      tags: ['fitness', 'exercise', 'wellness', 'gym', 'activity'],
    }),
    feature({
      featureId: 'facility_pool',
      featureType: 'FACILITY',
      name: 'Swimming Pool',
      category: 'WELLNESS',
      deepLink: 'app://facility/pool',
      tags: ['swimming', 'fitness', 'relaxation', 'recovery', 'pool'],
    }),
    feature({
      featureId: 'facility_yoga',
      featureType: 'FACILITY',
      name: 'Yoga Studio',
      category: 'WELLNESS',
      deepLink: 'app://facility/yoga',
      tags: ['yoga', 'gentle', 'stretch', 'wellness', 'relaxation'],
    }),
    feature({
      featureId: 'facility_tennis',
      featureType: 'FACILITY',
      name: 'Tennis Court',
      category: 'FITNESS',
      deepLink: 'app://facility/tennis',
      tags: ['fitness', 'activity', 'sports'],
    }),
    feature({
      featureId: 'service_spa',
      featureType: 'SERVICE',
      name: 'Spa',
      category: 'WELLNESS',
      deepLink: 'app://service/spa',
      tags: ['relaxation', 'wellness', 'recovery', 'spa'],
      serviceId: 'service_spa_001',
    }),
    feature({
      featureId: 'service_massage',
      featureType: 'SERVICE',
      name: 'Massage Therapy',
      category: 'WELLNESS',
      deepLink: 'app://service/massage',
      tags: ['relaxation', 'recovery', 'wellness', 'gentle'],
      serviceId: 'service_massage_001',
    }),
    feature({
      featureId: 'outlet_restaurant',
      featureType: 'OUTLET',
      name: 'Restaurant',
      category: 'DINING',
      deepLink: 'app://outlet/restaurant',
      tags: ['dining', 'food'],
      outletId: 'outlet_001',
    }),
    feature({
      featureId: 'outlet_cafe',
      featureType: 'OUTLET',
      name: 'Cafe',
      category: 'DINING',
      deepLink: 'app://outlet/cafe',
      tags: ['dining', 'food', 'coffee'],
      outletId: 'outlet_cafe_001',
    }),
    feature({
      featureId: 'outlet_bar',
      featureType: 'OUTLET',
      name: 'Lounge Bar',
      category: 'DINING',
      deepLink: 'app://outlet/bar',
      tags: ['dining', 'social'],
      outletId: 'outlet_bar_001',
    }),
    feature({
      featureId: 'outlet_bakery',
      featureType: 'OUTLET',
      name: 'Bakery',
      category: 'DINING',
      deepLink: 'app://outlet/bakery',
      tags: ['dining', 'food'],
      outletId: 'outlet_bakery_001',
    }),
    feature({
      featureId: 'outlet_healthy_kitchen',
      featureType: 'OUTLET',
      name: 'Healthy Kitchen',
      category: 'DINING',
      deepLink: 'app://outlet/healthy-kitchen',
      tags: ['dining', 'food', 'wellness'],
      outletId: 'outlet_healthy_001',
    }),
  ];

  for (const item of features) {
    await prisma.propertyFeature.upsert({
      where: {
        propertyId_featureId: { propertyId: property.propertyId, featureId: item.featureId },
      },
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

  console.log(
    `Seeded ${property.propertyId} with ${features.length} property features and 3 synthetic residents.`,
  );
}

function feature(input: {
  featureId: string;
  featureType: string;
  name: string;
  category: string;
  deepLink: string;
  tags: string[];
  serviceId?: string | null;
  outletId?: string | null;
}) {
  return {
    featureId: input.featureId,
    featureType: input.featureType,
    name: input.name,
    category: input.category,
    serviceId: input.serviceId ?? null,
    outletId: input.outletId ?? null,
    enabled: true,
    available: true,
    deepLink: input.deepLink,
    tags: input.tags,
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
      dataAvailability: availability as unknown as Prisma.InputJsonValue,
      dataQuality: 1,
    };
    await prisma.dailyHealthData.upsert({
      where: {
        wellnessUserId_date: { wellnessUserId: input.wellnessUserId, date },
      },
      create: { wellnessUserId: input.wellnessUserId, date, ...data },
      update: data,
    });
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
