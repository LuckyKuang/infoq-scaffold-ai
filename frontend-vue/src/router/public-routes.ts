import { isPathMatch } from '@/utils/validate';

const publicRoutes = [
  '/login',
  '/register',
  '/register*',
  '/register/*',
  '/forgot-password',
  '/forgot-password*',
  '/forgot-password/*',
  '/oauth/callback',
  '/oauth/callback*',
  '/oauth/callback/*'
];

export const isPublicRoute = (path: string) => publicRoutes.some((pattern) => isPathMatch(pattern, path));
