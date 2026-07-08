import {fireEvent, screen, waitFor} from '@testing-library/react';
import {StrictMode} from 'react';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import * as deptApi from '@/api/system/dept';
import * as menuApi from '@/api/system/menu';
import * as noticeApi from '@/api/system/notice';
import * as postApi from '@/api/system/post';
import * as roleApi from '@/api/system/role';
import * as userApi from '@/api/system/user';
import {clearInitialLoadEffectDedupe} from '@/hooks/useInitialLoadEffect';
import DeptPage from '@/pages/system/dept/index';
import MenuPage from '@/pages/system/menu/index';
import NoticePage from '@/pages/system/notice/index';
import PostPage from '@/pages/system/post/index';
import RolePage from '@/pages/system/role/index';
import UserPage from '@/pages/system/user/index';
import {setPermissionContext} from '@/utils/permission';
import {renderWithRouter} from '../helpers/renderWithRouter';

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
  sys_notice_status: [
    { label: '正常', value: '0' },
    { label: '关闭', value: '1' },
  ],
  sys_notice_type: [
    { label: '通知', value: '1' },
    { label: '公告', value: '2' },
  ],
}));

vi.mock('@umijs/max', async () => {
  const router =
    await vi.importActual<typeof import('react-router-dom')>(
      'react-router-dom',
    );
  return {
    Link: router.Link,
    Outlet: router.Outlet,
    useLocation: router.useLocation,
    useNavigate: router.useNavigate,
    useParams: router.useParams,
    useSearchParams: router.useSearchParams,
  };
});

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

vi.mock('@/components/Editor', () => ({
  default: () => <textarea data-testid="mock-editor" />,
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

vi.mock('@/api/system/notice', () => ({
  listNotice: vi.fn().mockResolvedValue({
    rows: [
      {
        noticeId: 100,
        noticeTitle: 'e2e_notice_a',
        noticeType: '1',
        status: '0',
        createByName: 'admin',
        createTime: '2026-03-10 10:00:00',
        noticeContent: '',
        remark: '',
      },
    ],
    total: 1,
  }),
  getNotice: vi.fn(),
  addNotice: vi.fn(),
  updateNotice: vi.fn(),
  delNotice: vi.fn(),
}));

function asResolvedValue<T>(value: unknown): T {
  return value as T;
}

beforeEach(() => {
  vi.clearAllMocks();
  clearInitialLoadEffectDedupe();
  setPermissionContext(['admin'], ['*:*:*']);
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
  vi.mocked(userApi.getUser).mockResolvedValue(
    asResolvedValue<Awaited<ReturnType<typeof userApi.getUser>>>({
      data: {
        user: {
          userId: 2,
          deptId: 100,
          userName: 'demo',
          nickName: '演示用户',
          userType: 'sys_user',
          email: '',
          phonenumber: '',
          sex: '0',
          avatar: '',
          status: '0',
          delFlag: '0',
          loginIp: '',
          loginDate: '',
          remark: '',
          deptName: '研发部',
          roles: [],
          admin: false,
        },
        roles: [
          {
            roleId: 1,
            roleName: '管理员',
            roleKey: 'admin',
            roleSort: 1,
            status: '0',
            createTime: '2026-03-10 10:00:00',
          },
        ],
        roleIds: [],
        posts: [{ postId: 10, postName: '研发岗' }],
        postIds: [],
        roleGroup: '',
        postGroup: '',
      },
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

  vi.mocked(noticeApi.listNotice).mockResolvedValue(
    asResolvedValue<Awaited<ReturnType<typeof noticeApi.listNotice>>>({
      rows: [
        {
          noticeId: 100,
          noticeTitle: 'e2e_notice_a',
          noticeType: '1',
          status: '0',
          createByName: 'admin',
          createTime: '2026-03-10 10:00:00',
          noticeContent: '',
          remark: '',
        },
      ],
      total: 1,
    }),
  );
  vi.mocked(noticeApi.getNotice).mockResolvedValue(
    asResolvedValue<Awaited<ReturnType<typeof noticeApi.getNotice>>>({
      data: {
        noticeId: 100,
        noticeTitle: 'e2e_notice_a',
        noticeType: '1',
        status: '0',
        noticeContent: '',
        remark: '',
        createByName: 'admin',
      },
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

  it('opens the user add dialog when create options omit posts', async () => {
    vi.mocked(userApi.getUser).mockResolvedValueOnce(
      asResolvedValue<Awaited<ReturnType<typeof userApi.getUser>>>({
        data: {
          roles: [
            {
              roleId: 1,
              roleName: '管理员',
              roleKey: 'admin',
              roleSort: 1,
              status: '0',
              createTime: '2026-03-10 10:00:00',
            },
          ],
          roleIds: [],
          postIds: [],
          roleGroup: '',
          postGroup: '',
        },
      }),
    );

    renderWithRouter(<UserPage />, '/system/user');

    expect(
      await screen.findByPlaceholderText('请输入用户名称'),
    ).toBeInTheDocument();
    const addButton = screen.getByText('新增').closest('button');
    if (!addButton) {
      throw new Error('未找到用户新增按钮');
    }
    fireEvent.click(addButton);

    expect(await screen.findByText('新增用户')).toBeInTheDocument();
    expect(screen.getByText('角色')).toBeInTheDocument();
    expect(userApi.getUser).toHaveBeenCalledWith();
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

  it('runs role management initial list once in strict mode', async () => {
    renderWithRouter(
      <StrictMode>
        <RolePage />
      </StrictMode>,
      '/system/role',
    );

    expect(
      await screen.findByPlaceholderText('请输入角色名称'),
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(roleApi.listRole).toHaveBeenCalledTimes(1);
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

  it('opens the root department add dialog with a stable parent selector and without default zoom motion', async () => {
    renderWithRouter(<DeptPage />, '/system/dept');

    expect(
      await screen.findByPlaceholderText('请输入部门名称'),
    ).toBeInTheDocument();
    const addButton = screen.getByText('新增').closest('button');
    if (!addButton) {
      throw new Error('未找到部门新增按钮');
    }
    fireEvent.click(addButton);

    expect(await screen.findByText('新增部门')).toBeInTheDocument();
    const dialog = document.querySelector('.ant-modal');
    expect(dialog).toBeInTheDocument();
    expect(dialog).not.toHaveClass('ant-zoom');
    expect(dialog).not.toHaveClass('ant-zoom-appear');
    expect(screen.getByText('上级部门')).toBeInTheDocument();
  });

  it('opens the child department add dialog with a stable parent selector', async () => {
    renderWithRouter(<DeptPage />, '/system/dept');

    expect(
      await screen.findByPlaceholderText('请输入部门名称'),
    ).toBeInTheDocument();
    const rowButtons = await waitFor(() => {
      const buttons = document.querySelectorAll('.ant-table-tbody button');
      expect(buttons.length).toBeGreaterThanOrEqual(2);
      return buttons;
    });
    fireEvent.click(rowButtons[1]);

    expect(await screen.findByText('新增部门')).toBeInTheDocument();
    expect(screen.getByText('上级部门')).toBeInTheDocument();
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

  it('keeps noticeId when editing a notice so submit updates instead of creating', async () => {
    renderWithRouter(<NoticePage />, '/system/notice');

    expect(
      await screen.findByPlaceholderText('请输入公告标题'),
    ).toBeInTheDocument();
    const rowButtons = await waitFor(() => {
      const buttons = document.querySelectorAll('.ant-table-tbody button');
      expect(buttons.length).toBeGreaterThanOrEqual(2);
      return buttons;
    });
    fireEvent.click(rowButtons[0]);

    expect(await screen.findByText('修改公告')).toBeInTheDocument();
    const titleInput = await waitFor(() => {
      const input = document.querySelector<HTMLInputElement>('#noticeTitle');
      if (!input) {
        throw new Error('未找到公告标题输入框');
      }
      return input;
    });
    fireEvent.change(titleInput, { target: { value: 'e2e_notice_b' } });
    const okButton = document.querySelector<HTMLButtonElement>(
      '.ant-modal-footer .ant-btn-primary',
    );
    if (!okButton) {
      throw new Error('未找到公告编辑确认按钮');
    }
    fireEvent.click(okButton);

    await waitFor(() => {
      expect(noticeApi.updateNotice).toHaveBeenCalledWith(
        expect.objectContaining({
          noticeId: 100,
          noticeTitle: 'e2e_notice_b',
        }),
      );
    });
    expect(noticeApi.addNotice).not.toHaveBeenCalled();
  });
});
