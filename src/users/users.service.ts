import { HttpStatus, Injectable } from '@nestjs/common';
import { WellnessUser } from '@prisma/client';
import { AppException } from '../common/exceptions/app.exception';
import { PrismaService } from '../database/prisma.service';

export interface UpsertWellnessUserInput {
  wellnessUserId: string;
  propertyId: string;
  timezone: string;
  platform: string;
  appVersion: string;
}

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async upsert(input: UpsertWellnessUserInput): Promise<WellnessUser> {
    return this.prisma.wellnessUser.upsert({
      where: { wellnessUserId: input.wellnessUserId },
      create: input,
      update: {
        propertyId: input.propertyId,
        timezone: input.timezone,
        platform: input.platform,
        appVersion: input.appVersion,
      },
    });
  }

  async requireById(wellnessUserId: string): Promise<WellnessUser> {
    const user = await this.prisma.wellnessUser.findUnique({ where: { wellnessUserId } });
    if (!user) {
      throw new AppException(
        'USER_NOT_FOUND',
        'Wellness user was not found',
        HttpStatus.NOT_FOUND,
      );
    }
    return user;
  }
}
