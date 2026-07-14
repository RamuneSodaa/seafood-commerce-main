import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import {
  CustomerAuthArtifactService,
  type VerifiedCustomerAuthIdentity
} from './customer-auth-artifact.service';

type AuthenticatedRequest = {
  headers: Record<string, unknown>;
  authenticatedCustomer?: VerifiedCustomerAuthIdentity;
};

@Injectable()
export class CustomerAuthArtifactGuard implements CanActivate {
  constructor(private readonly customerAuthArtifactService: CustomerAuthArtifactService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authorizationHeader = (req.headers.authorization || '').toString().trim();

    if (!authorizationHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing Bearer customer auth artifact');
    }

    const artifact = authorizationHeader.slice('Bearer '.length).trim();
    req.authenticatedCustomer = this.customerAuthArtifactService.verify(artifact);

    return true;
  }
}
