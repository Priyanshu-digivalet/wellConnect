import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { FEEDBACK_ACTIONS } from '../../common/wellness.constants';

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
}
