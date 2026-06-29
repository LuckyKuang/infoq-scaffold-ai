import { screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithRouter } from '../helpers/renderWithRouter';

const dictOptions = vi.hoisted(() => ({
  sys_device_type: [{ label: 'PC', value: 'pc' }],
  sys_common_status: [
    { label: '成功', value: '0' },
    { label: '失败', value: '1' },
  ],
  sys_oper_type: [{ label: '查询', value: '0' }],
  sys_normal_disable: [
    { label: '正常', value: '0' },
    { label: '停用', value: '1' },
  ],
}));

const chartMocks = vi.hoisted(() => ({
  chartInit: vi.fn(),
  chartSetOption: vi.fn(),
  chartResize: vi.fn(),
  chartDispose: vi.fn(),
}));

vi.mock('@/hooks/useDictOptions', () => ({
  default: (...types: string[]) =>
    Object.fromEntries(
      types.map((type) => [
        type,
        dictOptions[type as keyof typeof dictOptions] || [],
      ]),
    ),
}));

vi.mock('@/components/Pagination', () => ({
  default: () => <div data-testid="pagination" />,
}));

vi.mock('@/components/RightToolbar', () => ({
  default: () => <div data-testid="right-toolbar" />,
}));

vi.mock('@/components/DictTag', () => ({
  default: ({
    options = [],
    value,
  }: {
    options?: Array<{ label: string; value: string | number }>;
    value?: string | number | Array<string | number>;
  }) => {
    const values = Array.isArray(value)
      ? value.map(String)
      : value !== undefined
        ? [String(value)]
        : [];
    const text = values
      .map(
        (item) =>
          options.find((option) => String(option.value) === item)?.label ||
          item,
      )
      .join(',');
    return <span>{text}</span>;
  },
}));

vi.mock('@/utils/modal', () => ({
  default: {
    confirm: vi.fn().mockResolvedValue(true),
    msgSuccess: vi.fn(),
    msgWarning: vi.fn(),
    msgError: vi.fn(),
    loading: vi.fn(),
    closeLoading: vi.fn(),
  },
}));

vi.mock('@/utils/echarts', () => ({
  default: {
    init: chartMocks.chartInit,
  },
}));

vi.mock('@/pages/system/role/selectUser', () => ({
  default: ({ open }: { open?: boolean }) =>
    open ? <div>选择用户弹窗</div> : null,
}));

vi.mock('@/pages/system/user/profile/userAvatar', () => ({
  default: () => <div>头像上传</div>,
}));

vi.mock('@/pages/system/user/profile/userInfo', () => ({
  default: () => <div>基本资料表单</div>,
}));

vi.mock('@/pages/system/user/profile/resetPwd', () => ({
  default: () => <div>修改密码表单</div>,
}));

vi.mock('@/pages/system/user/profile/onlineDevice', () => ({
  default: ({ devices }: { devices?: unknown[] }) => (
    <div>在线设备列表 {devices?.length || 0}</div>
  ),
}));

vi.mock('@/api/monitor/online', () => ({
  list: vi.fn().mockResolvedValue({
    rows: [
      {
        tokenId: 'token-1',
        userName: 'admin',
        clientKey: 'pc-web',
        deviceType: 'pc',
        deptName: '研发部',
        loginLocation: '上海',
      },
    ],
    total: 1,
  }),
  getOnline: vi.fn().mockResolvedValue({
    rows: [
      {
        tokenId: 'token-1',
        userName: 'admin',
        clientKey: 'pc-web',
        deviceType: 'pc',
      },
    ],
  }),
  forceLogout: vi.fn(),
}));

vi.mock('@/api/monitor/loginInfo', () => ({
  list: vi.fn().mockResolvedValue({
    rows: [
      {
        infoId: 1,
        userName: 'admin',
        clientKey: 'pc-web',
        deviceType: 'pc',
        ipaddr: '127.0.0.1',
        status: '0',
        msg: '登录成功',
      },
    ],
    total: 1,
  }),
  cleanLoginInfo: vi.fn(),
  delLoginInfo: vi.fn(),
  unlockLoginInfo: vi.fn(),
}));

vi.mock('@/api/monitor/operLog', () => ({
  list: vi.fn().mockResolvedValue({
    rows: [
      {
        operId: 1,
        title: '用户管理',
        businessType: 0,
        operName: 'admin',
        status: 0,
        operTime: '2026-03-10 10:00:00',
        costTime: 12,
      },
    ],
    total: 1,
  }),
  cleanOperLog: vi.fn(),
  delOperLog: vi.fn(),
}));

vi.mock('@/api/monitor/cache', () => ({
  getCache: vi.fn().mockResolvedValue({
    data: {
      dbSize: 12,
      info: {
        redis_version: '7.2.0',
        redis_mode: 'standalone',
        tcp_port: '6379',
        connected_clients: '3',
        uptime_in_days: '9',
        used_memory_human: '12M',
        used_cpu_user_children: '0.11',
        maxmemory_human: '256M',
        aof_enabled: '1',
        rdb_last_bgsave_status: 'ok',
        instantaneous_input_kbps: '1.2',
        instantaneous_output_kbps: '1.0',
      },
      commandStats: [{ name: 'get', value: '20' }],
    },
  }),
}));

vi.mock('@/api/system/role', () => ({
  allocatedUserList: vi.fn().mockResolvedValue({
    rows: [
      {
        userId: 1,
        userName: 'admin',
        nickName: '管理员',
        phonenumber: '13800000000',
        status: '0',
      },
    ],
    total: 1,
  }),
  authUserCancel: vi.fn(),
  authUserCancelAll: vi.fn(),
}));

vi.mock('@/api/system/user', () => ({
  getAuthRole: vi.fn().mockResolvedValue({
    data: {
      user: { userId: 1, userName: 'admin', nickName: '管理员' },
      roles: [
        {
          roleId: 1,
          roleName: '管理员',
          roleKey: 'admin',
          status: '0',
          flag: true,
        },
      ],
    },
  }),
  updateAuthRole: vi.fn(),
  getUserProfile: vi.fn().mockResolvedValue({
    data: {
      user: {
        userName: 'admin',
        phonenumber: '13800000000',
        email: 'admin@example.com',
        deptName: '研发部',
        createTime: '2026-03-10',
      },
      roleGroup: '管理员',
      postGroup: '研发岗',
    },
  }),
}));

const { default: OnlinePage } = await import('@/pages/monitor/online/index');
const { default: LoginInfoPage } = await import(
  '@/pages/monitor/loginInfo/index'
);
const { default: OperLogPage } = await import('@/pages/monitor/operLog/index');
const { default: CachePage } = await import('@/pages/monitor/cache/index');
const { default: AuthUserPage } = await import('@/pages/system/role/authUser');
const { default: AuthRolePage } = await import('@/pages/system/user/authRole');
const { default: ProfilePage } = await import(
  '@/pages/system/user/profile/index'
);
const onlineApi = await import('@/api/monitor/online');
const loginInfoApi = await import('@/api/monitor/loginInfo');
const operLogApi = await import('@/api/monitor/operLog');
const cacheApi = await import('@/api/monitor/cache');
const roleApi = await import('@/api/system/role');
const userApi = await import('@/api/system/user');

function asResolvedValue<T>(value: unknown): T {
  return value as T;
}

beforeEach(() => {
  chartMocks.chartInit.mockReturnValue({
    setOption: chartMocks.chartSetOption,
    resize: chartMocks.chartResize,
    dispose: chartMocks.chartDispose,
  });
  vi.mocked(onlineApi.list).mockResolvedValue(
    asResolvedValue<Awaited<ReturnType<typeof onlineApi.list>>>({
      rows: [
        {
          tokenId: 'token-1',
          userName: 'admin',
          clientKey: 'pc-web',
          deviceType: 'pc',
          deptName: '研发部',
          loginLocation: '上海',
        },
      ],
      total: 1,
    }),
  );
  vi.mocked(onlineApi.getOnline).mockResolvedValue(
    asResolvedValue<Awaited<ReturnType<typeof onlineApi.getOnline>>>({
      rows: [
        {
          tokenId: 'token-1',
          userName: 'admin',
          clientKey: 'pc-web',
          deviceType: 'pc',
        },
      ],
    }),
  );
  vi.mocked(loginInfoApi.list).mockResolvedValue(
    asResolvedValue<Awaited<ReturnType<typeof loginInfoApi.list>>>({
      rows: [
        {
          infoId: 1,
          userName: 'admin',
          clientKey: 'pc-web',
          deviceType: 'pc',
          ipaddr: '127.0.0.1',
          status: '0',
          msg: '登录成功',
        },
      ],
      total: 1,
    }),
  );
  vi.mocked(operLogApi.list).mockResolvedValue(
    asResolvedValue<Awaited<ReturnType<typeof operLogApi.list>>>({
      rows: [
        {
          operId: 1,
          title: '用户管理',
          businessType: 0,
          operName: 'admin',
          status: 0,
          operTime: '2026-03-10 10:00:00',
          costTime: 12,
        },
      ],
      total: 1,
    }),
  );
  vi.mocked(cacheApi.getCache).mockResolvedValue(
    asResolvedValue<Awaited<ReturnType<typeof cacheApi.getCache>>>({
      data: {
        dbSize: 12,
        info: {
          redis_version: '7.2.0',
          redis_mode: 'standalone',
          tcp_port: '6379',
          connected_clients: '3',
          uptime_in_days: '9',
          used_memory_human: '12M',
          used_cpu_user_children: '0.11',
          maxmemory_human: '256M',
          aof_enabled: '1',
          rdb_last_bgsave_status: 'ok',
          instantaneous_input_kbps: '1.2',
          instantaneous_output_kbps: '1.0',
        },
        commandStats: [{ name: 'get', value: '20' }],
      },
    }),
  );
  vi.mocked(roleApi.allocatedUserList).mockResolvedValue(
    asResolvedValue<Awaited<ReturnType<typeof roleApi.allocatedUserList>>>({
      rows: [
        {
          userId: 1,
          userName: 'admin',
          nickName: '管理员',
          phonenumber: '13800000000',
          status: '0',
        },
      ],
      total: 1,
    }),
  );
  vi.mocked(userApi.getAuthRole).mockResolvedValue(
    asResolvedValue<Awaited<ReturnType<typeof userApi.getAuthRole>>>({
      data: {
        user: { userId: 1, userName: 'admin', nickName: '管理员' },
        roles: [
          {
            roleId: 1,
            roleName: '管理员',
            roleKey: 'admin',
            status: '0',
            flag: true,
          },
        ],
      },
    }),
  );
  vi.mocked(userApi.getUserProfile).mockResolvedValue(
    asResolvedValue<Awaited<ReturnType<typeof userApi.getUserProfile>>>({
      data: {
        user: {
          userName: 'admin',
          phonenumber: '13800000000',
          email: 'admin@example.com',
          deptName: '研发部',
          createTime: '2026-03-10',
        },
        roleGroup: '管理员',
        postGroup: '研发岗',
      },
    }),
  );
});

describe('pages/monitor-auth-profile', () => {
  it('renders the online page with active sessions', async () => {
    renderWithRouter(<OnlinePage />, '/monitor/online');

    expect(
      await screen.findByPlaceholderText('请输入登录地址'),
    ).toBeInTheDocument();
    expect(await screen.findByText('上海')).toBeInTheDocument();
    await waitFor(() => {
      expect(onlineApi.list).toHaveBeenCalled();
    });
  });

  it('renders the login info page with access logs', async () => {
    renderWithRouter(<LoginInfoPage />, '/monitor/loginInfo');

    expect(
      await screen.findByPlaceholderText('请输入登录地址'),
    ).toBeInTheDocument();
    expect(await screen.findByText('登录成功')).toBeInTheDocument();
    await waitFor(() => {
      expect(loginInfoApi.list).toHaveBeenCalled();
    });
  });

  it('renders the oper log page with operation logs', async () => {
    renderWithRouter(<OperLogPage />, '/monitor/operLog');

    expect(
      await screen.findByPlaceholderText('请输入系统模块'),
    ).toBeInTheDocument();
    expect(await screen.findByText('12毫秒')).toBeInTheDocument();
    await waitFor(() => {
      expect(operLogApi.list).toHaveBeenCalled();
    });
  });

  it('renders the cache page with cache metrics', async () => {
    renderWithRouter(<CachePage />, '/monitor/cache');

    expect(screen.getByText('基本信息')).toBeInTheDocument();
    await waitFor(() => {
      expect(cacheApi.getCache).toHaveBeenCalled();
    });
  });

  it('renders the auth user page with allocated users', async () => {
    renderWithRouter(<AuthUserPage />, '/system/role-auth/user/1');

    expect(
      await screen.findByPlaceholderText('请输入用户名称'),
    ).toBeInTheDocument();
    expect(await screen.findByText('添加用户')).toBeInTheDocument();
    await waitFor(() => {
      expect(roleApi.allocatedUserList).toHaveBeenCalled();
    });
  });

  it('renders the auth role page with role selections', async () => {
    renderWithRouter(<AuthRolePage />, '/system/user-auth/role/1');

    expect(await screen.findByText('角色信息')).toBeInTheDocument();
    await waitFor(() => {
      expect(userApi.getAuthRole).toHaveBeenCalledWith('1');
    });
  });

  it('renders the profile page with profile data', async () => {
    renderWithRouter(<ProfilePage />, '/user/profile');

    expect(screen.getByText('个人信息')).toBeInTheDocument();
    await waitFor(() => {
      expect(userApi.getUserProfile).toHaveBeenCalled();
      expect(onlineApi.getOnline).toHaveBeenCalled();
    });
  });
});
