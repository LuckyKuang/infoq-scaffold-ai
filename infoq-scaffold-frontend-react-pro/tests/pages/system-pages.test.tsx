import { screen, waitFor } from '@testing-library/react';
import { StrictMode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithRouter } from '../helpers/renderWithRouter';

const dictOptions = vi.hoisted(() => ({
  sys_normal_disable: [
    { label: '正常', value: '0' },
    { label: '停用', value: '1' },
  ],
  sys_user_sex: [
    { label: '男', value: '0' },
    { label: '女', value: '1' },
  ],
  sys_show_hide: [
    { label: '显示', value: '0' },
    { label: '隐藏', value: '1' },
  ],
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

vi.mock('@/api/system/user', () => ({
  listUser: vi.fn().mockResolvedValue({
    rows: [
      {
        userId: 1,
        userName: 'admin',
        nickName: '管理员',
        deptName: '研发部',
        phonenumber: '13800000000',
        status: '0',
        createTime: '2026-03-10 10:00:00',
      },
    ],
    total: 1,
  }),
  deptTreeSelect: vi.fn().mockResolvedValue({
    data: [{ id: 100, label: '研发部', children: [] }],
  }),
  listUserByDeptId: vi.fn().mockResolvedValue({
    data: [{ userId: 1, userName: 'admin' }],
  }),
  addUser: vi.fn(),
  changeUserStatus: vi.fn(),
  delUser: vi.fn(),
  getUser: vi.fn(),
  resetUserPwd: vi.fn(),
  updateUser: vi.fn(),
}));

vi.mock('@/api/system/role', () => ({
  listRole: vi.fn().mockResolvedValue({
    rows: [
      {
        roleId: 1,
        roleName: '管理员',
        roleKey: 'admin',
        roleSort: 1,
        status: '0',
        createTime: '2026-03-10 10:00:00',
      },
    ],
    total: 1,
  }),
  deptTreeSelect: vi.fn().mockResolvedValue({
    data: {
      depts: [{ id: 100, label: '研发部', children: [] }],
      checkedKeys: [100],
    },
  }),
  addRole: vi.fn(),
  changeRoleStatus: vi.fn(),
  dataScope: vi.fn(),
  delRole: vi.fn(),
  getRole: vi.fn(),
  updateRole: vi.fn(),
  allocatedUserList: vi.fn(),
  authUserCancel: vi.fn(),
  authUserCancelAll: vi.fn(),
}));

vi.mock('@/api/system/menu', () => ({
  listMenu: vi.fn().mockResolvedValue({
    data: [
      {
        menuId: 1,
        parentId: 0,
        menuName: '系统管理',
        orderNum: 1,
        status: '0',
        createTime: '2026-03-10 10:00:00',
      },
    ],
  }),
  roleMenuTreeselect: vi.fn().mockResolvedValue({
    data: {
      menus: [{ id: 1, label: '系统管理', children: [] }],
      checkedKeys: [1],
    },
  }),
  treeselect: vi.fn().mockResolvedValue({
    data: [{ id: 1, label: '系统管理', children: [] }],
  }),
  addMenu: vi.fn(),
  cascadeDelMenu: vi.fn(),
  delMenu: vi.fn(),
  getMenu: vi.fn(),
  updateMenu: vi.fn(),
}));

vi.mock('@/api/system/dept', () => ({
  listDept: vi.fn().mockResolvedValue({
    data: [
      {
        deptId: 100,
        parentId: 0,
        deptName: '研发部',
        deptCategory: 'RD',
        orderNum: 1,
        status: '0',
        createTime: '2026-03-10 10:00:00',
      },
    ],
  }),
  listDeptExcludeChild: vi.fn().mockResolvedValue({ data: [] }),
  addDept: vi.fn(),
  delDept: vi.fn(),
  getDept: vi.fn(),
  updateDept: vi.fn(),
}));

vi.mock('@/api/system/post', () => ({
  listPost: vi.fn().mockResolvedValue({
    rows: [
      {
        postId: 10,
        postCode: 'RD-01',
        postCategory: 'TECH',
        postName: '研发岗',
        deptName: '研发部',
        postSort: 1,
        status: '0',
      },
    ],
    total: 1,
  }),
  deptTreeSelect: vi.fn().mockResolvedValue({
    data: [{ id: 100, label: '研发部', children: [] }],
  }),
  optionselect: vi.fn().mockResolvedValue({
    data: [{ postId: 10, postName: '研发岗' }],
  }),
  addPost: vi.fn(),
  delPost: vi.fn(),
  getPost: vi.fn(),
  updatePost: vi.fn(),
}));

const { default: UserPage } = await import('@/pages/system/user/index');
const { default: RolePage } = await import('@/pages/system/role/index');
const { default: MenuPage } = await import('@/pages/system/menu/index');
const { default: DeptPage } = await import('@/pages/system/dept/index');
const { default: PostPage } = await import('@/pages/system/post/index');
const userApi = await import('@/api/system/user');
const roleApi = await import('@/api/system/role');
const menuApi = await import('@/api/system/menu');
const deptApi = await import('@/api/system/dept');
const postApi = await import('@/api/system/post');

function asResolvedValue<T>(value: unknown): T {
  return value as T;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(userApi.listUser).mockResolvedValue(
    asResolvedValue<Awaited<ReturnType<typeof userApi.listUser>>>({
      rows: [
        {
          userId: 1,
          userName: 'admin',
          nickName: '管理员',
          deptName: '研发部',
          phonenumber: '13800000000',
          status: '0',
          createTime: '2026-03-10 10:00:00',
        },
      ],
      total: 1,
    }),
  );
  vi.mocked(userApi.deptTreeSelect).mockResolvedValue(
    asResolvedValue<Awaited<ReturnType<typeof userApi.deptTreeSelect>>>({
      data: [{ id: 100, label: '研发部', children: [] }],
    }),
  );
  vi.mocked(userApi.listUserByDeptId).mockResolvedValue(
    asResolvedValue<Awaited<ReturnType<typeof userApi.listUserByDeptId>>>({
      data: [{ userId: 1, userName: 'admin' }],
    }),
  );

  vi.mocked(roleApi.listRole).mockResolvedValue(
    asResolvedValue<Awaited<ReturnType<typeof roleApi.listRole>>>({
      rows: [
        {
          roleId: 1,
          roleName: '管理员',
          roleKey: 'admin',
          roleSort: 1,
          status: '0',
          createTime: '2026-03-10 10:00:00',
        },
      ],
      total: 1,
    }),
  );
  vi.mocked(roleApi.deptTreeSelect).mockResolvedValue(
    asResolvedValue<Awaited<ReturnType<typeof roleApi.deptTreeSelect>>>({
      data: {
        depts: [{ id: 100, label: '研发部', children: [] }],
        checkedKeys: [100],
      },
    }),
  );

  vi.mocked(menuApi.listMenu).mockResolvedValue(
    asResolvedValue<Awaited<ReturnType<typeof menuApi.listMenu>>>({
      data: [
        {
          menuId: 1,
          parentId: 0,
          menuName: '系统管理',
          orderNum: 1,
          status: '0',
          createTime: '2026-03-10 10:00:00',
        },
      ],
    }),
  );
  vi.mocked(menuApi.roleMenuTreeselect).mockResolvedValue(
    asResolvedValue<Awaited<ReturnType<typeof menuApi.roleMenuTreeselect>>>({
      data: {
        menus: [{ id: 1, label: '系统管理', children: [] }],
        checkedKeys: [1],
      },
    }),
  );
  vi.mocked(menuApi.treeselect).mockResolvedValue(
    asResolvedValue<Awaited<ReturnType<typeof menuApi.treeselect>>>({
      data: [{ id: 1, label: '系统管理', children: [] }],
    }),
  );

  vi.mocked(deptApi.listDept).mockResolvedValue(
    asResolvedValue<Awaited<ReturnType<typeof deptApi.listDept>>>({
      data: [
        {
          deptId: 100,
          parentId: 0,
          deptName: '研发部',
          deptCategory: 'RD',
          orderNum: 1,
          status: '0',
          createTime: '2026-03-10 10:00:00',
        },
      ],
    }),
  );
  vi.mocked(deptApi.listDeptExcludeChild).mockResolvedValue(
    asResolvedValue<Awaited<ReturnType<typeof deptApi.listDeptExcludeChild>>>({
      data: [],
    }),
  );

  vi.mocked(postApi.listPost).mockResolvedValue(
    asResolvedValue<Awaited<ReturnType<typeof postApi.listPost>>>({
      rows: [
        {
          postId: 10,
          postCode: 'RD-01',
          postCategory: 'TECH',
          postName: '研发岗',
          deptName: '研发部',
          postSort: 1,
          status: '0',
        },
      ],
      total: 1,
    }),
  );
  vi.mocked(postApi.deptTreeSelect).mockResolvedValue(
    asResolvedValue<Awaited<ReturnType<typeof postApi.deptTreeSelect>>>({
      data: [{ id: 100, label: '研发部', children: [] }],
    }),
  );
  vi.mocked(postApi.optionselect).mockResolvedValue(
    asResolvedValue<Awaited<ReturnType<typeof postApi.optionselect>>>({
      data: [{ postId: 10, postName: '研发岗' }],
    }),
  );
});

describe('pages/system', () => {
  it('renders the user management page with fetched rows', async () => {
    renderWithRouter(<UserPage />, '/system/user');

    expect(
      await screen.findByPlaceholderText('请输入用户名称'),
    ).toBeInTheDocument();
    expect(screen.getAllByText('用户昵称').length).toBeGreaterThan(0);
    await waitFor(() => {
      expect(userApi.listUser).toHaveBeenCalled();
      expect(userApi.deptTreeSelect).toHaveBeenCalled();
      expect(roleApi.listRole).toHaveBeenCalled();
      expect(postApi.optionselect).toHaveBeenCalled();
    });
  });

  it('runs user management initial requests once in strict mode', async () => {
    renderWithRouter(
      <StrictMode>
        <UserPage />
      </StrictMode>,
      '/system/user',
    );

    expect(
      await screen.findByPlaceholderText('请输入用户名称'),
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(userApi.listUser).toHaveBeenCalledTimes(1);
      expect(userApi.deptTreeSelect).toHaveBeenCalledTimes(1);
      expect(roleApi.listRole).toHaveBeenCalledTimes(1);
      expect(postApi.optionselect).toHaveBeenCalledTimes(1);
    });
  });

  it('renders the role management page with fetched rows', async () => {
    renderWithRouter(<RolePage />, '/system/role');

    expect(
      await screen.findByPlaceholderText('请输入角色名称'),
    ).toBeInTheDocument();
    expect(screen.getAllByText('权限字符').length).toBeGreaterThan(0);
    await waitFor(() => {
      expect(roleApi.listRole).toHaveBeenCalled();
    });
  });

  it('renders the menu management page with fetched rows', async () => {
    renderWithRouter(<MenuPage />, '/system/menu');

    expect(
      await screen.findByPlaceholderText('请输入菜单名称'),
    ).toBeInTheDocument();
    expect(screen.getAllByText('菜单名称').length).toBeGreaterThan(0);
    await waitFor(() => {
      expect(menuApi.listMenu).toHaveBeenCalled();
    });
  });

  it('runs menu management initial list once in strict mode', async () => {
    renderWithRouter(
      <StrictMode>
        <MenuPage />
      </StrictMode>,
      '/system/menu',
    );

    expect(
      await screen.findByPlaceholderText('请输入菜单名称'),
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(menuApi.listMenu).toHaveBeenCalledTimes(1);
    });
  });

  it('renders the department management page with fetched rows', async () => {
    renderWithRouter(<DeptPage />, '/system/dept');

    expect(
      await screen.findByPlaceholderText('请输入部门名称'),
    ).toBeInTheDocument();
    expect(screen.getAllByText('类别编码').length).toBeGreaterThan(0);
    await waitFor(() => {
      expect(deptApi.listDept).toHaveBeenCalled();
    });
  });

  it('runs department management initial dept list once in strict mode', async () => {
    renderWithRouter(
      <StrictMode>
        <DeptPage />
      </StrictMode>,
      '/system/dept',
    );

    expect(
      await screen.findByPlaceholderText('请输入部门名称'),
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(deptApi.listDept).toHaveBeenCalledTimes(1);
      expect(deptApi.listDept).toHaveBeenCalledWith({
        pageNum: 1,
        pageSize: 10,
        deptName: '',
        deptCategory: '',
        status: undefined,
      });
    });
  });

  it('renders the post management page with fetched rows', async () => {
    renderWithRouter(<PostPage />, '/system/post');

    expect(
      await screen.findByPlaceholderText('请输入岗位编码'),
    ).toBeInTheDocument();
    expect(screen.getAllByText('岗位名称').length).toBeGreaterThan(0);
    await waitFor(() => {
      expect(postApi.listPost).toHaveBeenCalled();
      expect(postApi.deptTreeSelect).toHaveBeenCalled();
    });
  });
});
