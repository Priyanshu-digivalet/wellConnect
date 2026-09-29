import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { PrismaService } from '../database/prisma.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  @Get()
  @SkipThrottle()
  @ApiOperation({ summary: 'API and database health' })
  async check() {
    const connected = await this.prisma.ping();
    return {
      status: connected ? 'ok' : 'degraded',
      database: connected ? 'connected' : 'disconnected',
      timestamp: new Date().toISOString(),
      environment: this.config.get<string>('nodeEnv') ?? 'development',
    };
  }
}
