import { Body, Controller, HttpCode, HttpStatus, Post, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthUser } from '../auth/auth.types';
// import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ApiStandardErrors } from '../common/decorators/api-standard-errors.decorator';
import { SubmitFeedbackDto } from './dto/submit-feedback.dto';
import { FeedbackService } from './feedback.service';

@ApiTags('wellness')
// @ApiBearerAuth('bearer')
// @UseGuards(JwtAuthGuard)
@Controller('wellness')
export class FeedbackController {
  constructor(private readonly feedback: FeedbackService) {}

  @Post('feedback')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Store recommendation feedback and update preference signals' })
  @ApiStandardErrors()
  submit(
    @CurrentUser() user: AuthUser,
    @Body() dto: SubmitFeedbackDto,
    @Req() request: Request,
  ) {
    return this.feedback.submit(user, dto, request.requestId ?? 'none');
  }
}
