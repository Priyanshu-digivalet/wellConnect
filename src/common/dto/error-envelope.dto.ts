import { ApiProperty } from '@nestjs/swagger';

export class ErrorDetailDto {
  @ApiProperty({ example: 'INVALID_HEALTH_DATA' })
  code!: string;

  @ApiProperty({ example: 'Health data validation failed' })
  message!: string;

  @ApiProperty({ type: [Object], example: [] })
  details!: unknown[];
}

export class ErrorEnvelopeDto {
  @ApiProperty({ example: false })
  success!: false;

  @ApiProperty({ type: ErrorDetailDto })
  error!: ErrorDetailDto;

  @ApiProperty({ example: '0b6c1c2e-1b2a-4f3a-9c1d-123456789abc' })
  requestId!: string | null;
}
