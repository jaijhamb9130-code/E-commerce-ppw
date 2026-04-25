
export function getDefaultRoute(user: any): string {
  if (!user) return '/login';
  if (user.role === 'admin') return '/';
  const perms: string[] = Array.isArray(user.permissions) ? user.permissions : [];
  if (perms.includes('dashboard')) return '/';
  if (perms.includes('orders')) return '/online-orders';
  if (perms.includes('reports')) return '/orders';
  if (perms.includes('inventory')) return '/';
  if (perms.includes('staff')) return '/profile';
  return '/login'; // No permissions at all — force logout
}
