import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class TodayRecommendationQueryDto {
  @ApiPropertyOptional({
    example: '2026-09-29',
    description:
      'Calendar day (YYYY-MM-DD). Defaults to the current UTC date. Returns the latest ACTIVE recommendation created on that day.',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  date?: string;

  @ApiPropertyOptional({
    example: 'property_001',
    description:
      'Property scope. When auth is disabled for local testing, also used as the caller propertyId fallback.',
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  @Matches(/^[A-Za-z0-9_-]+$/)
  propertyId?: string;
}
