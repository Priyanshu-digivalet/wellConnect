import { randomBytes } from 'crypto';

export function createPublicId(prefix: string): string {
  return `${prefix}_${randomBytes(4).toString('hex')}`;
}
