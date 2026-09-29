import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiStandardErrors } from '../common/decorators/api-standard-errors.decorator';
import { AuthService } from './auth.service';
import { DevTokenDto } from './dto/dev-token.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('dev-token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Issue a development JWT',
    description:
      'Enabled only when AUTH_DEV_MODE=true. This is the integration point to replace with the host application authentication system. It never accepts a raw resident name, email, or phone number.',
  })
  @ApiOkResponse({
    description: 'Bearer token for the pseudonymous wellness user',
  })
  @ApiStandardErrors()
  issueDevToken(@Body() dto: DevTokenDto) {
    return this.auth.issueDevToken(dto);
  }
}
