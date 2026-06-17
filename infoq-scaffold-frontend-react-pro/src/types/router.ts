import type { ReactNode } from 'react';

export interface RouteMeta {
  title?: string;
  icon?: string;
  affix?: boolean;
  noCache?: boolean;
  link?: string;
  activeMenu?: string;
  breadcrumb?: boolean;
}

export interface AppRoute {
  path: string;
  name?: string;
  hidden?: boolean | string | number;
  permissions?: string[];
  roles?: string[];
  alwaysShow?: boolean;
  query?: string;
  parentPath?: string;
  redirect?: string;
  component?: string;
  meta?: RouteMeta;
  children?: AppRoute[];
  element?: ReactNode;
}
