import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AppException } from '../common/exceptions/app.exception';
import { PrismaService } from '../database/prisma.service';
import { AuthUser, JwtPayload, UserRole } from './auth.types';
import { DevTokenDto } from './dto/dev-token.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async issueDevToken(dto: DevTokenDto): Promise<{
    accessToken: string;
    tokenType: 'Bearer';
    expiresIn: string;
    wellnessUserId: string;
    propertyId: string;
    role: UserRole;
  }> {
    if (!this.config.get<boolean>('authDevMode')) {
      throw new AppException('NOT_FOUND', 'Not found', HttpStatus.NOT_FOUND);
    }

    const property = await this.prisma.property.findUnique({
      where: { propertyId: dto.propertyId },
    });
    if (!property || !property.enabled) {
      throw new AppException(
        'PROPERTY_NOT_FOUND',
        'Property was not found or is disabled',
        HttpStatus.NOT_FOUND,
      );
    }

    const role = dto.role ?? 'RESIDENT';
    await this.prisma.wellnessUser.upsert({
      where: { wellnessUserId: dto.wellnessUserId },
      create: {
        wellnessUserId: dto.wellnessUserId,
        propertyId: dto.propertyId,
        timezone: property.timezone,
        platform: 'ANDROID',
        appVersion: '0.0.0',
      },
      update: {
        propertyId: dto.propertyId,
      },
    });

    const payload: JwtPayload = {
      sub: dto.wellnessUserId,
      propertyId: dto.propertyId,
      role,
    };
    const expiresIn = this.config.get<string>('jwtExpiresIn') ?? '7d';
    const accessToken = await this.jwt.signAsync(payload);
    this.logger.log(
      `dev_token_issued wellnessUserId=${dto.wellnessUserId} propertyId=${dto.propertyId} role=${role}`,
    );
    return {
      accessToken,
      tokenType: 'Bearer',
      expiresIn,
      wellnessUserId: dto.wellnessUserId,
      propertyId: dto.propertyId,
      role,
    };
  }

  toAuthUser(payload: JwtPayload): AuthUser {
    return {
      wellnessUserId: payload.sub,
      propertyId: payload.propertyId,
      role: payload.role,
    };
  }
}
