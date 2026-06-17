import type { UserInfoVO } from './types';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const assertRecord = (value: unknown, label: string) => {
  if (!isRecord(value)) {
    throw new Error(`${label} 必须是对象`);
  }
  return value;
};

const assertArray = (value: unknown, label: string) => {
  if (!Array.isArray(value)) {
    throw new Error(`${label} 必须是数组`);
  }
};

const assertString = (value: unknown, label: string) => {
  if (typeof value !== 'string') {
    throw new Error(`${label} 必须是字符串`);
  }
};

export const assertUserProfileData = (
  value: unknown,
  label = '用户资料响应 data',
): UserInfoVO => {
  const data = assertRecord(value, label);
  assertRecord(data.user, `${label}.user`);
  assertString(data.roleGroup, `${label}.roleGroup`);
  assertString(data.postGroup, `${label}.postGroup`);
  return value as UserInfoVO;
};

export const assertUserDetailData = (
  value: unknown,
  label = '用户详情响应 data',
): UserInfoVO => {
  const data = assertRecord(value, label);
  assertRecord(data.user, `${label}.user`);
  assertArray(data.roles, `${label}.roles`);
  assertArray(data.posts, `${label}.posts`);
  assertArray(data.roleIds, `${label}.roleIds`);
  assertArray(data.postIds, `${label}.postIds`);
  return value as UserInfoVO;
};

export const assertAvatarUploadData = (
  value: unknown,
  label = '头像上传响应 data',
): { imgUrl: string } => {
  const data = assertRecord(value, label);
  assertString(data.imgUrl, `${label}.imgUrl`);
  const imgUrl = data.imgUrl as string;
  if (!imgUrl.trim()) {
    throw new Error(`${label}.imgUrl 不能为空`);
  }
  return { imgUrl };
};
