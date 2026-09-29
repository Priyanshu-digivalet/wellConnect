import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { UserRole } from '../auth.types';

export class DevTokenDto {
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

  @ApiPropertyOptional({ enum: ['RESIDENT', 'PROPERTY_ADMIN'], default: 'RESIDENT' })
  @IsOptional()
  @IsIn(['RESIDENT', 'PROPERTY_ADMIN'])
  role?: UserRole;
}
