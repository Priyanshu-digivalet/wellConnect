import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

/** Identity for wellness recommendation/profile routes when JWT auth is bypassed. */
export class WellnessUserQueryDto {
  @ApiProperty({
    example: 'wu_2949cf41f9ef41db',
    description: 'Dynamic wellness user id — response is scoped to this resident only',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  @Matches(/^[A-Za-z0-9_-]+$/)
  wellnessUserId!: string;

  @ApiPropertyOptional({
    example: 'property_001',
    description: 'Property scope. Defaults to property_001 when omitted during local testing.',
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  @Matches(/^[A-Za-z0-9_-]+$/)
  propertyId?: string;
}
