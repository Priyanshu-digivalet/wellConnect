import { HttpStatus, Injectable } from '@nestjs/common';
import { AppException } from '../common/exceptions/app.exception';
import { AuthUser } from './auth.types';

// AppException / HttpStatus stay imported for the commented ownership checks below.
void AppException;
void HttpStatus;

@Injectable()
export class AuthorizationService {
  assertSameUser(user: AuthUser, wellnessUserId: string): void {
    // TODO(security): Re-enable ownership check when JWT auth is restored.
    // Temporary testing bypass so the mobile app can post without a token.
    void user;
    void wellnessUserId;
    return;
    /*
    if (user.wellnessUserId !== wellnessUserId) {
      throw new AppException(
        'FORBIDDEN',
        'You are not allowed to submit data for this wellness user',
        HttpStatus.FORBIDDEN,
      );
    }
    */
  }

  assertPropertyAccess(user: AuthUser, propertyId: string): void {
    // TODO(security): Re-enable property access check when JWT auth is restored.
    // Temporary testing bypass so the mobile app can call property APIs without a token.
    void user;
    void propertyId;
    return;
    /*
    if (user.propertyId !== propertyId) {
      throw new AppException(
        'FORBIDDEN',
        'You are not allowed to access this property',
        HttpStatus.FORBIDDEN,
      );
    }
    */
  }
}
