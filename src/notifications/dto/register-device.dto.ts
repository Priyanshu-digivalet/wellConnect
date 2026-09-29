import { ApiProperty } from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class RegisterDeviceDto {
  @ApiProperty({
    example: 'wu_a3cfcd1bc9824269',
    description: 'Dynamic wellness user id this device belongs to',
  })
  @IsString()
  @MaxLength(64)
  @Matches(/^[A-Za-z0-9_-]+$/)
  wellnessUserId!: string;

  @ApiProperty({ example: 'property_001' })
  @IsString()
  @MaxLength(64)
  @Matches(/^[A-Za-z0-9_-]+$/)
  propertyId!: string;

  @ApiProperty({ example: 'device-123' })
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  deviceId!: string;

  @ApiProperty({ example: 'ANDROID', enum: ['ANDROID', 'IOS'] })
  @IsIn(['ANDROID', 'IOS'])
  platform!: 'ANDROID' | 'IOS';

  @ApiProperty({ example: 'fcm-token' })
  @IsString()
  @MinLength(1)
  @MaxLength(4096)
  fcmToken!: string;

  @ApiProperty({ example: '1.0.0' })
  @IsString()
  @MaxLength(32)
  appVersion!: string;

  @ApiProperty({ example: 'Asia/Kolkata', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  timezone?: string;

  @ApiProperty({ example: true, required: false })
  @IsOptional()
  @IsBoolean()
  notificationsEnabled?: boolean;
}
