import { UserProfile } from '@ciadelivery/users';
import { UserListResponse, UserResponse } from './auth.dto';

export function toUserBody(user: UserProfile): UserResponse {
  return {
    id: user.id,
    tenantId: user.tenantId,
    storeId: user.storeId,
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status,
    permissions: [...user.permissions],
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

export function toUserPageBody(page: {
  items: UserProfile[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}): UserListResponse {
  return {
    data: page.items.map(toUserBody),
    meta: {
      page: page.page,
      pageSize: page.pageSize,
      total: page.total,
      totalPages: page.totalPages,
    },
  };
}
