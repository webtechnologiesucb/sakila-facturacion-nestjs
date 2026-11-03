import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import { UserRole } from '@prisma/client';

export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext) => {
  return ctx.switchToHttp().getRequest().user;
});

export const Roles = (...roles: UserRole[]) => SetMetadata('roles', roles);

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
}
