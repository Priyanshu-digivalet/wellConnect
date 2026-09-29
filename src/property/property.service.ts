import { HttpStatus, Injectable } from '@nestjs/common';
import { Prisma, PropertyFeature } from '@prisma/client';
import { AuthUser } from '../auth/auth.types';
import { AuthorizationService } from '../auth/authorization.service';
import { AppException } from '../common/exceptions/app.exception';
import { PrismaService } from '../database/prisma.service';
import { CreateFeatureDto } from './dto/create-feature.dto';

@Injectable()
export class PropertyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authorization: AuthorizationService,
  ) {}

  async listFeatures(user: AuthUser, propertyId: string) {
    this.authorization.assertPropertyAccess(user, propertyId);
    await this.requireProperty(propertyId);
    const features = await this.prisma.propertyFeature.findMany({
      where: {
        propertyId,
        ...(user.role === 'PROPERTY_ADMIN' ? {} : { enabled: true }),
      },
      orderBy: { name: 'asc' },
    });
    return features.map(toFeatureView);
  }

  async createFeature(user: AuthUser, propertyId: string, dto: CreateFeatureDto) {
    this.authorization.assertPropertyAccess(user, propertyId);
    await this.requireProperty(propertyId);
    try {
      const feature = await this.prisma.propertyFeature.create({
        data: {
          propertyId,
          featureId: dto.featureId,
          featureType: dto.featureType,
          name: dto.name,
          category: dto.category,
          serviceId: dto.serviceId ?? null,
          outletId: dto.outletId ?? null,
          enabled: dto.enabled ?? true,
          available: dto.available ?? true,
          deepLink: dto.deepLink,
          tags: (dto.tags ?? []) as Prisma.InputJsonValue,
        },
      });
      return toFeatureView(feature);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new AppException(
          'FEATURE_EXISTS',
          'A feature with this id already exists for the property',
          HttpStatus.CONFLICT,
        );
      }
      throw error;
    }
  }

  async requireEnabledProperty(propertyId: string) {
    const property = await this.requireProperty(propertyId);
    if (!property.enabled) {
      throw new AppException(
        'PROPERTY_NOT_FOUND',
        'Property was not found or is disabled',
        HttpStatus.NOT_FOUND,
      );
    }
    return property;
  }

  private async requireProperty(propertyId: string) {
    const property = await this.prisma.property.findUnique({ where: { propertyId } });
    if (!property) {
      throw new AppException(
        'PROPERTY_NOT_FOUND',
        'Property was not found',
        HttpStatus.NOT_FOUND,
      );
    }
    return property;
  }
}

export function toFeatureView(feature: PropertyFeature) {
  return {
    featureId: feature.featureId,
    propertyId: feature.propertyId,
    featureType: feature.featureType,
    name: feature.name,
    category: feature.category,
    serviceId: feature.serviceId,
    outletId: feature.outletId,
    enabled: feature.enabled,
    available: feature.available,
    deepLink: feature.deepLink,
    tags: feature.tags,
  };
}
