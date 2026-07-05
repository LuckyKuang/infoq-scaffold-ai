import {describe, expect, it} from 'vitest';
import {assertAvatarUploadData, assertUserDetailData, assertUserProfileData,} from '@/api/system/user/guards';

const user = {
  userId: 1,
  deptId: 100,
  userName: 'admin',
  nickName: 'Admin',
  userType: 'sys_user',
  email: 'admin@example.com',
  phonenumber: '13800000000',
  sex: '0',
  avatar: '',
  status: '0',
  delFlag: '0',
  loginIp: '',
  loginDate: '',
  remark: '',
  deptName: '研发部',
  roles: [],
  admin: true,
};

describe('system user guards', () => {
  it('accepts complete profile data and rejects missing user payload', () => {
    const data = { user, roleGroup: '管理员', postGroup: '开发' };

    expect(assertUserProfileData(data)).toBe(data);
    expect(() =>
      assertUserProfileData({ roleGroup: '管理员', postGroup: '开发' }),
    ).toThrow('用户资料响应 data.user 必须是对象');
  });

  it('requires role id arrays and normalizes optional post fields for user detail forms', () => {
    const data = {
      user,
      roles: [],
      posts: [],
      roleIds: ['1'],
      postIds: ['2'],
      roleGroup: '',
      postGroup: '',
    };

    expect(assertUserDetailData(data)).toEqual(data);
    expect(
      assertUserDetailData({ ...data, posts: undefined, postIds: undefined }),
    ).toMatchObject({
      posts: [],
      postIds: [],
    });
    expect(() => assertUserDetailData({ ...data, roleIds: undefined })).toThrow(
      '用户详情响应 data.roleIds 必须是数组',
    );
  });

  it('requires a non-empty avatar upload url', () => {
    expect(
      assertAvatarUploadData({ imgUrl: 'https://cdn.example.com/avatar.png' }),
    ).toEqual({ imgUrl: 'https://cdn.example.com/avatar.png' });
    expect(() => assertAvatarUploadData({})).toThrow(
      '头像上传响应 data.imgUrl 必须是字符串',
    );
    expect(() => assertAvatarUploadData({ imgUrl: '' })).toThrow(
      '头像上传响应 data.imgUrl 不能为空',
    );
  });
});
