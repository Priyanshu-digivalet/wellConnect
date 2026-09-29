import { Controller, Get, HttpCode, HttpStatus, Post, Query, Req } from '@nestjs/common';
import { ApiNotFoundResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthUser } from '../auth/auth.types';
// import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ApiStandardErrors } from '../common/decorators/api-standard-errors.decorator';
import { ErrorEnvelopeDto } from '../common/dto/error-envelope.dto';
import { TodayRecommendationQueryDto } from './dto/today-recommendation.query.dto';
import { RecommendationsService } from './recommendations.service';

@ApiTags('wellness')
// @ApiBearerAuth('bearer')
// @UseGuards(JwtAuthGuard)
@Controller('wellness')
export class RecommendationsController {
  constructor(private readonly recommendations: RecommendationsService) {}

  @Get('profile')
  @ApiOperation({
    summary: 'Get the latest calculated wellness profile and decision state',
    description: 'GET /api/v1/wellness/profile — no query params; identity from auth context.',
  })
  @ApiStandardErrors()
  profile(@CurrentUser() user: AuthUser) {
    return this.recommendations.getProfile(user);
  }

  @Get('recommendations/today')
  @ApiOperation({
    summary: "Get today's active wellness recommendation",
    description:
      'GET /api/v1/wellness/recommendations/today — returns the latest ACTIVE recommendation created on the given calendar day (UTC). Optional query: date (YYYY-MM-DD), propertyId.',
  })
  @ApiNotFoundResponse({ type: ErrorEnvelopeDto })
  @ApiStandardErrors()
  today(@CurrentUser() user: AuthUser, @Query() query: TodayRecommendationQueryDto) {
    return this.recommendations.getToday(user, query);
  }

  @Get('recommendations')
  @ApiOperation({
    summary: 'List recent recommendations for the authenticated resident',
    description: 'GET /api/v1/wellness/recommendations — returns up to 20 recent recommendations.',
  })
  @ApiStandardErrors()
  list(@CurrentUser() user: AuthUser) {
    return this.recommendations.list(user);
  }

  @Post('recommendations/generate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Generate a recommendation from stored health data without uploading a new payload',
    description:
      'POST /api/v1/wellness/recommendations/generate — no body required; uses stored health data for the authenticated resident.',
  })
  @ApiStandardErrors()
  generate(@CurrentUser() user: AuthUser, @Req() request: Request) {
    return this.recommendations.generateForUser(user.wellnessUserId, request.requestId ?? 'none');
  }
}
