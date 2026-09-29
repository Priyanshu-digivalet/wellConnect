import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateFeatureDto {
  @ApiProperty({ example: 'service_spa' })
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  @Matches(/^[a-z0-9_]+$/)
  featureId!: string;

  @ApiProperty({ example: 'SPA' })
  @IsString()
  @MinLength(1)
  @MaxLength(32)
  @Matches(/^[A-Z0-9_]+$/)
  featureType!: string;

  @ApiProperty({ example: 'Spa' })
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name!: string;

  @ApiProperty({ example: 'WELLNESS' })
  @IsString()
  @MinLength(1)
  @MaxLength(32)
  category!: string;

  @ApiPropertyOptional({ example: 'spa' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  serviceId?: string;

  @ApiPropertyOptional({ example: 'restaurant' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  outletId?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  available?: boolean;

  @ApiProperty({ example: 'app://service/spa' })
  @IsString()
  @Matches(/^app:\/\/[A-Za-z0-9/_-]+$/)
  deepLink!: string;

  @ApiPropertyOptional({ type: [String], example: ['recovery'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}
