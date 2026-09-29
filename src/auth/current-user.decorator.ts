import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthUser } from './auth.types';

/**
 * TODO(security): Restore JWT-only identity once mobile auth is integrated.
 * For local/mobile testing, auth guards are commented out and this decorator
 * falls back to body/headers/defaults so the API stays callable without a token.
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser => {
    const request = ctx.switchToHttp().getRequest<{
      user?: AuthUser;
      body?: {
        userContext?: { wellnessUserId?: string; propertyId?: string };
        wellnessUserId?: string;
        propertyId?: string;
      };
      headers: Record<string, string | string[] | undefined>;
      query?: Record<string, string | string[] | undefined>;
    }>();

    // Future: when JwtAuthGuard is re-enabled, request.user will be set by Passport.
    if (request.user?.wellnessUserId && request.user?.propertyId) {
      return request.user;
    }

    const headerUser = firstHeader(request.headers['x-wellness-user-id']);
    const headerProperty = firstHeader(request.headers['x-property-id']);
    const queryUser = firstValue(request.query?.wellnessUserId);
    const queryProperty = firstValue(request.query?.propertyId);
    const bodyUser =
      request.body?.userContext?.wellnessUserId ?? request.body?.wellnessUserId;
    const bodyProperty =
      request.body?.userContext?.propertyId ?? request.body?.propertyId;

    return {
      wellnessUserId:
        headerUser || queryUser || bodyUser || 'wu_recovery_001',
      propertyId: headerProperty || queryProperty || bodyProperty || 'property_001',
      role: 'RESIDENT',
    };
  },
);

function firstHeader(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

function firstValue(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}
