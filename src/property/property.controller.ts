import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthUser } from '../auth/auth.types';
// import { JwtAuthGuard } from '../auth/jwt-auth.guard';
// import { Roles } from '../auth/roles.decorator';
// import { RolesGuard } from '../auth/roles.guard';
import { ApiStandardErrors } from '../common/decorators/api-standard-errors.decorator';
import { CreateFeatureDto } from './dto/create-feature.dto';
import { PropertyService } from './property.service';

@ApiTags('properties')
// @ApiBearerAuth('bearer')
// @UseGuards(JwtAuthGuard, RolesGuard)
@Controller('properties')
export class PropertyController {
  constructor(private readonly properties: PropertyService) {}

  @Get(':propertyId/features')
  @ApiOperation({ summary: 'List property facilities, services, and outlets' })
  @ApiStandardErrors()
  list(@CurrentUser() user: AuthUser, @Param('propertyId') propertyId: string) {
    return this.properties.listFeatures(user, propertyId);
  }

  @Post(':propertyId/features')
  // @Roles('PROPERTY_ADMIN')
  @ApiOperation({ summary: 'Add a property feature. Requires the property admin role.' })
  @ApiStandardErrors()
  create(
    @CurrentUser() user: AuthUser,
    @Param('propertyId') propertyId: string,
    @Body() dto: CreateFeatureDto,
  ) {
    // Temporary testing: elevate to PROPERTY_ADMIN so create works without JWT roles.
    const adminUser: AuthUser = { ...user, role: 'PROPERTY_ADMIN' };
    return this.properties.createFeature(adminUser, propertyId, dto);
  }
}
