import { Controller, Get, HttpCode, HttpStatus, Post, Query, Req } from '@nestjs/common';
import { ApiNotFoundResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthUser } from '../auth/auth.types';
// import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ApiStandardErrors } from '../common/decorators/api-standard-errors.decorator';
import { ErrorEnvelopeDto } from '../common/dto/error-envelope.dto';
import { TodayRecommendationQueryDto } from './dto/today-recommendation.query.dto';
import { WellnessUserQueryDto } from './dto/wellness-user.query.dto';
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
    description:
      'GET /api/v1/wellness/profile?wellnessUserId=... — scoped to the given wellness user id.',
  })
  @ApiStandardErrors()
  profile(@CurrentUser() user: AuthUser, @Query() query: WellnessUserQueryDto) {
    return this.recommendations.getProfile(resolveWellnessUser(user, query));
  }

  @Get('recommendations/today')
  @ApiOperation({
    summary: "Get today's active wellness recommendation",
    description:
      'GET /api/v1/wellness/recommendations/today?wellnessUserId=... — optional date, propertyId.',
  })
  @ApiNotFoundResponse({ type: ErrorEnvelopeDto })
  @ApiStandardErrors()
  today(@CurrentUser() user: AuthUser, @Query() query: TodayRecommendationQueryDto) {
    return this.recommendations.getToday(resolveWellnessUser(user, query), query);
  }

  @Get('recommendations')
  @ApiOperation({
    summary: 'List recent recommendations for a wellness user',
    description:
      'GET /api/v1/wellness/recommendations?wellnessUserId=... — returns up to 20 recent recommendations for that resident only.',
  })
  @ApiStandardErrors()
  list(@CurrentUser() user: AuthUser, @Query() query: WellnessUserQueryDto) {
    return this.recommendations.list(resolveWellnessUser(user, query));
  }

  @Post('recommendations/generate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Generate a recommendation from stored health data without uploading a new payload',
    description:
      'POST /api/v1/wellness/recommendations/generate?wellnessUserId=... — uses stored health data for that resident.',
  })
  @ApiStandardErrors()
  generate(
    @CurrentUser() user: AuthUser,
    @Query() query: WellnessUserQueryDto,
    @Req() request: Request,
  ) {
    const resolved = resolveWellnessUser(user, query);
    return this.recommendations.generateForUser(
      resolved.wellnessUserId,
      request.requestId ?? 'none',
    );
  }
}

function resolveWellnessUser(
  user: AuthUser,
  query: { wellnessUserId: string; propertyId?: string },
): AuthUser {
  return {
    ...user,
    wellnessUserId: query.wellnessUserId,
    propertyId: query.propertyId ?? user.propertyId,
  };
}
