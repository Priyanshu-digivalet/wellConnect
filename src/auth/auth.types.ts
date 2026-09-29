export type UserRole = 'RESIDENT' | 'PROPERTY_ADMIN';

export interface AuthUser {
  wellnessUserId: string;
  propertyId: string;
  role: UserRole;
}

export interface JwtPayload {
  sub: string;
  propertyId: string;
  role: UserRole;
}
