import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class RegisterDeviceDto {
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

  @ApiProperty({ example: true, required: false })
  @IsOptional()
  @IsBoolean()
  notificationsEnabled?: boolean;
}
