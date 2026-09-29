import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { FEEDBACK_ACTIONS } from '../../common/wellness.constants';

export class FeedbackContextDto {
  @ApiPropertyOptional({
    example: 3,
    description: 'Break duration in minutes, used for break-style pattern detection',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(60)
  breakDurationMinutes?: number;
}

export class SubmitFeedbackDto {
  @ApiProperty({ example: 'rec_8f92ab' })
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  recommendationId!: string;

  @ApiProperty({ enum: FEEDBACK_ACTIONS, example: 'CLICKED' })
  @IsIn(FEEDBACK_ACTIONS)
  action!: (typeof FEEDBACK_ACTIONS)[number];

  @ApiPropertyOptional({ example: 5, minimum: 1, maximum: 5 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  rating?: number;

  @ApiPropertyOptional({ example: 'Nice suggestion' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  feedback?: string;

  @ApiPropertyOptional({ type: FeedbackContextDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => FeedbackContextDto)
  context?: FeedbackContextDto;
}
