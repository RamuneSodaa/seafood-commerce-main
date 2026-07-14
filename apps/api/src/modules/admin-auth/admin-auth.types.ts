import type { AdminRole } from '@prisma/client';

export type AdminAuthIdentity = {
  adminId: string;
  username: string;
  displayName: string;
  role: AdminRole;
  storeId: string | null;
};

export type RequestWithAdmin = {
  admin?: AdminAuthIdentity;
  headers: Record<string, string | string[] | undefined>;
};
