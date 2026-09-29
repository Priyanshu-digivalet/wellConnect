import { applyDecorators } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiForbiddenResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ErrorEnvelopeDto } from '../dto/error-envelope.dto';

export function ApiStandardErrors() {
  return applyDecorators(
    ApiBadRequestResponse({ type: ErrorEnvelopeDto }),
    ApiUnauthorizedResponse({ type: ErrorEnvelopeDto }),
    ApiForbiddenResponse({ type: ErrorEnvelopeDto }),
  );
}
