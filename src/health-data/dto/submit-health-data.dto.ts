import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  Equals,
  IsBoolean,
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  Validate,
  ValidateNested,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import {
  MAX_ACTIVE_CALORIES,
  MAX_DISTANCE_METERS,
  MAX_HEALTH_DAYS,
  MAX_HEART_RATE,
  MAX_SLEEP_MINUTES,
  MAX_STEPS,
  MIN_HEART_RATE,
  SCHEMA_VERSION,
} from '../../common/wellness.constants';

@ValidatorConstraint({ name: 'uniqueDates', async: false })
export class UniqueDatesConstraint implements ValidatorConstraintInterface {
  validate(days: Array<{ date?: string }> | undefined): boolean {
    if (!Array.isArray(days)) {
      return false;
    }
    const dates = days.map((day) => day?.date);
    return new Set(dates).size === dates.length;
  }

  defaultMessage(): string {
    return 'dailyHealthData contains duplicate dates';
  }
}

export class DataAvailabilityDto {
  @ApiProperty()
  @IsBoolean()
  steps!: boolean;

  @ApiProperty()
  @IsBoolean()
  distance!: boolean;

  @ApiProperty()
  @IsBoolean()
  activeCalories!: boolean;

  @ApiProperty()
  @IsBoolean()
  restingHeartRate!: boolean;

  @ApiProperty()
  @IsBoolean()
  averageHeartRate!: boolean;

  @ApiProperty()
  @IsBoolean()
  sleep!: boolean;
}

export class DayContextDto {
  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  meetingHeavy?: boolean;
}

export class DailyHealthDataDto {
  @ApiProperty({ example: '2026-09-23' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  date!: string;

  @ApiProperty({ example: 8421 })
  @IsInt()
  @Min(0)
  @Max(MAX_STEPS)
  steps!: number;

  @ApiProperty({ example: 6120 })
  @IsInt()
  @Min(0)
  @Max(MAX_DISTANCE_METERS)
  distanceMeters!: number;

  @ApiProperty({ example: 472 })
  @IsInt()
  @Min(0)
  @Max(MAX_ACTIVE_CALORIES)
  activeCalories!: number;

  @ApiProperty({ example: 63, required: false, nullable: true })
  @IsOptional()
  @IsInt()
  @Min(MIN_HEART_RATE)
  @Max(MAX_HEART_RATE)
  restingHeartRate?: number | null;

  @ApiProperty({ example: 79, required: false, nullable: true })
  @IsOptional()
  @IsInt()
  @Min(MIN_HEART_RATE)
  @Max(MAX_HEART_RATE)
  averageHeartRate?: number | null;

  @ApiProperty({ example: 438, required: false, nullable: true })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(MAX_SLEEP_MINUTES)
  sleepMinutes?: number | null;

  @ApiProperty({ type: DataAvailabilityDto })
  @ValidateNested()
  @Type(() => DataAvailabilityDto)
  dataAvailability!: DataAvailabilityDto;

  @ApiPropertyOptional({
    description: '24 hourly step buckets for pattern detection (index 0 = midnight hour)',
    example: [0, 0, 0, 0, 120, 450, 800],
  })
  @IsOptional()
  @ArrayMinSize(24)
  @ArrayMaxSize(24)
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(MAX_STEPS, { each: true })
  hourlySteps?: number[];

  @ApiPropertyOptional({ type: DayContextDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => DayContextDto)
  dayContext?: DayContextDto;
}

export class UserContextDto {
  @ApiProperty({ example: 'wu_recovery_001' })
  @IsString()
  @MaxLength(64)
  @Matches(/^[A-Za-z0-9_-]+$/)
  wellnessUserId!: string;

  @ApiProperty({ example: 'property_001' })
  @IsString()
  @MaxLength(64)
  @Matches(/^[A-Za-z0-9_-]+$/)
  propertyId!: string;

  @ApiProperty({ example: '1.0.0' })
  @IsString()
  @MaxLength(32)
  appVersion!: string;

  @ApiProperty({ example: 'ANDROID', enum: ['ANDROID', 'IOS'] })
  @IsIn(['ANDROID', 'IOS'])
  platform!: 'ANDROID' | 'IOS';

  @ApiProperty({ example: 'Asia/Kolkata' })
  @IsString()
  @MaxLength(64)
  timezone!: string;

  @ApiPropertyOptional({
    example: 'android-phone-1',
    description:
      'Optional. When sent with fcmToken, upserts NotificationDevice on this health-data call.',
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  deviceId?: string;

  @ApiPropertyOptional({
    example: 'fcm-token-from-firebase-sdk',
    description:
      'Optional. When sent with deviceId, upserts NotificationDevice on this health-data call.',
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(4096)
  fcmToken?: string;

  @ApiPropertyOptional({ example: true, default: true })
  @IsOptional()
  @IsBoolean()
  notificationsEnabled?: boolean;
}

export class DataContextDto {
  @ApiProperty({ example: '2026-09-29T10:30:00+05:30' })
  @IsISO8601()
  generatedAt!: string;

  @ApiProperty({ example: '2026-09-23' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  dataFrom!: string;

  @ApiProperty({ example: '2026-09-29' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  dataTo!: string;

  @ApiProperty({ example: 7 })
  @IsInt()
  @Min(1)
  @Max(MAX_HEALTH_DAYS)
  daysAvailable!: number;
}

export class SubmitHealthDataDto {
  @ApiProperty({ example: SCHEMA_VERSION })
  @Equals(SCHEMA_VERSION)
  schemaVersion!: string;

  @ApiProperty({ type: UserContextDto })
  @ValidateNested()
  @Type(() => UserContextDto)
  userContext!: UserContextDto;

  @ApiProperty({ type: DataContextDto })
  @ValidateNested()
  @Type(() => DataContextDto)
  dataContext!: DataContextDto;

  @ApiProperty({ type: [DailyHealthDataDto] })
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_HEALTH_DAYS)
  @ValidateNested({ each: true })
  @Type(() => DailyHealthDataDto)
  @Validate(UniqueDatesConstraint)
  dailyHealthData!: DailyHealthDataDto[];
}
