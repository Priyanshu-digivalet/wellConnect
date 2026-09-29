import { Body, Controller, HttpCode, HttpStatus, Post, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthUser } from '../auth/auth.types';
// import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ApiStandardErrors } from '../common/decorators/api-standard-errors.decorator';
import { SubmitHealthDataDto } from './dto/submit-health-data.dto';
import { HealthDataService } from './health-data.service';

@ApiTags('wellness')
// @ApiBearerAuth('bearer')
// @UseGuards(JwtAuthGuard)
@Controller('wellness')
export class HealthDataController {
  constructor(private readonly healthData: HealthDataService) {}

  @Post('health-data')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Ingest normalized Health Connect data and refresh the wellness recommendation',
  })
  @ApiStandardErrors()
  submit(
    @CurrentUser() user: AuthUser,
    @Body() dto: SubmitHealthDataDto,
    @Req() request: Request,
  ) {
    return this.healthData.ingest(user, dto, request.requestId ?? 'none');
  }
}
