import { Injectable, InternalServerErrorException, UnauthorizedException } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';
import { UserRole } from '../../common/roles/role.enum';

type CustomerAuthArtifactClaims = {
  v: 1;
  provider: 'wechat';
  userId: string;
  role: UserRole.CUSTOMER;
  iat: number;
};

export type VerifiedCustomerAuthIdentity = {
  provider: 'wechat';
  userId: string;
  role: UserRole.CUSTOMER;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

@Injectable()
export class CustomerAuthArtifactService {
  private readonly secretEnvName = 'CUSTOMER_AUTH_ARTIFACT_SECRET';

  issue(identity: VerifiedCustomerAuthIdentity): string {
    const claims: CustomerAuthArtifactClaims = {
      v: 1,
      provider: identity.provider,
      userId: identity.userId,
      role: UserRole.CUSTOMER,
      iat: Date.now()
    };
    const encodedPayload = Buffer.from(JSON.stringify(claims)).toString('base64url');
    const signature = this.sign(encodedPayload);

    return `${encodedPayload}.${signature}`;
  }

  verify(artifact: string): VerifiedCustomerAuthIdentity {
    const trimmedArtifact = artifact.trim();

    if (!trimmedArtifact) {
      throw new UnauthorizedException('Missing customer auth artifact');
    }

    const [encodedPayload, providedSignature, ...rest] = trimmedArtifact.split('.');

    if (!encodedPayload || !providedSignature || rest.length > 0) {
      throw new UnauthorizedException('Invalid customer auth artifact');
    }

    const expectedSignature = this.sign(encodedPayload);
    const providedBuffer = Buffer.from(providedSignature);
    const expectedBuffer = Buffer.from(expectedSignature);

    if (providedBuffer.length !== expectedBuffer.length || !timingSafeEqual(providedBuffer, expectedBuffer)) {
      throw new UnauthorizedException('Invalid customer auth artifact signature');
    }

    let parsedPayload: unknown;

    try {
      parsedPayload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'));
    } catch {
      throw new UnauthorizedException('Invalid customer auth artifact payload');
    }

    if (!isRecord(parsedPayload)) {
      throw new UnauthorizedException('Invalid customer auth artifact payload');
    }

    if (parsedPayload.v !== 1 || parsedPayload.provider !== 'wechat' || parsedPayload.role !== UserRole.CUSTOMER) {
      throw new UnauthorizedException('Invalid customer auth artifact claims');
    }

    const userId = typeof parsedPayload.userId === 'string' ? parsedPayload.userId.trim() : '';

    if (!userId) {
      throw new UnauthorizedException('Invalid customer auth artifact userId');
    }

    return {
      provider: 'wechat',
      userId,
      role: UserRole.CUSTOMER
    };
  }

  private sign(encodedPayload: string): string {
    const secret = process.env[this.secretEnvName]?.trim();

    if (!secret) {
      throw new InternalServerErrorException(`${this.secretEnvName} is not configured`);
    }

    return createHmac('sha256', secret).update(encodedPayload).digest('base64url');
  }
}
