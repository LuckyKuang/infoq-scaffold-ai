import { isPathMatch } from '@/utils/validate';

const whiteList = [
  '/login',
  '/login*',
  '/login/*',
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

export const isWhiteListRoute = (path: string) => {
  return whiteList.some((pattern) => isPathMatch(pattern, path));
};
