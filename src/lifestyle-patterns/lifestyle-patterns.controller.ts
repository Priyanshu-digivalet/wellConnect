import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthUser } from '../auth/auth.types';
import { ApiStandardErrors } from '../common/decorators/api-standard-errors.decorator';
import { LifestylePatternsService } from './lifestyle-patterns.service';

@ApiTags('wellness')
@Controller('wellness')
export class LifestylePatternsController {
  constructor(private readonly lifestyle: LifestylePatternsService) {}

  @Get('dashboard')
  @ApiOperation({
    summary: 'Wellness dashboard with lifestyle summary and suggested journey',
    description:
      'GET /api/v1/wellness/dashboard — behavioral pattern insights from the first two weeks, lifestyle summary, and personalized wellness journey steps.',
  })
  @ApiStandardErrors()
  dashboard(@CurrentUser() user: AuthUser) {
    return this.lifestyle.getDashboard(user);
  }
}
