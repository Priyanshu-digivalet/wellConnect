import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthUser } from '../auth/auth.types';
// import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ApiStandardErrors } from '../common/decorators/api-standard-errors.decorator';
import { RegisterDeviceDto } from './dto/register-device.dto';
import { NotificationService } from './notification.service';

@ApiTags('notifications')
// @ApiBearerAuth('bearer')
// @UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationService) {}

  @Post('devices')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Register or refresh an FCM device token' })
  @ApiStandardErrors()
  register(@CurrentUser() user: AuthUser, @Body() dto: RegisterDeviceDto) {
    return this.notifications.registerDevice(user, dto);
  }

  @Post(':id/opened')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark a notification as opened' })
  @ApiStandardErrors()
  opened(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.notifications.markOpened(user, id);
  }

  @Post(':id/actioned')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark a notification as actioned' })
  @ApiStandardErrors()
  actioned(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.notifications.markActioned(user, id);
  }
}
