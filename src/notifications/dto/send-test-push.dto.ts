import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class SendTestPushDto {
  @ApiProperty({ example: 'WellConnect test', required: false })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  title?: string;

  @ApiProperty({
    example: 'If you see this, FCM delivery is working.',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  body?: string;

  @ApiProperty({
    example: 'device-123',
    required: false,
    description: 'When set, only this registered device receives the push',
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  deviceId?: string;

  @ApiProperty({ example: 'service_spa', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  featureId?: string;

  @ApiProperty({ example: 'app://service/spa', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(512)
  deepLink?: string;
}
