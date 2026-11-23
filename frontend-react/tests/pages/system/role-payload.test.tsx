import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { renderWithRouter } from '../../helpers/renderWithRouter';
import { useUserStore } from '@/store/modules/user';

const roleApiMocks = vi.hoisted(() => ({
  listRole: vi.fn(),
  getRole: vi.fn(),
  addRole: vi.fn(),
  updateRole: vi.fn(),
  dataScope: vi.fn(),
  deptTreeSelect: vi.fn(),
  changeRoleStatus: vi.fn(),
  delRole: vi.fn()
}));
const menuApiMocks = vi.hoisted(() => ({
  roleMenuTreeselect: vi.fn(),
  treeselect: vi.fn()
}));

vi.mock('@/api/system/role', () => roleApiMocks);
vi.mock('@/api/system/menu', () => menuApiMocks);
vi.mock('@/hooks/useDictOptions', () => ({
  default: () => ({ sys_normal_disable: [{ label: '正常', value: '0' }] })
}));
vi.mock('@/components/Pagination', () => ({ default: () => <div /> }));
vi.mock('@/components/RightToolbar', () => ({ default: () => <div /> }));
vi.mock('@/utils/modal', () => ({
  default: { confirm: vi.fn().mockResolvedValue(true), msgSuccess: vi.fn(), msgWarning: vi.fn(), msgError: vi.fn() }
}));

const { default: RolePage } = await import('@/pages/system/role/index');

const menuTree = [
  {
    id: 1,
    label: '系统管理',
    children: [
      { id: 11, label: '用户管理', children: [] },
      { id: 12, label: '角色管理', children: [] }
    ]
  }
];
const deptTree = [
  {
    id: 100,
    label: '总公司',
    children: [
      { id: 101, label: '研发部', children: [] },
      { id: 102, label: '财务部', children: [] }
    ]
  }
];

const roleDetail = (overrides: Record<string, unknown> = {}) => ({
  data: {
    roleId: 2,
    roleName: '运维',
    roleKey: 'ops',
    roleSort: 2,
    status: '0',
    remark: '',
    dataScope: '2',
    menuCheckStrictly: true,
    deptCheckStrictly: true,
    ...overrides
  }
});

const checkNode = (title: string) => {
  const node = screen.getByText(title).closest('.ant-tree-treenode') as HTMLElement;
  fireEvent.click(node.querySelector('.ant-tree-checkbox') as HTMLElement);
};

const sortedKeys = (keys: unknown) => [...(keys as string[])].map(String).sort();

describe('pages/system/role payloads', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useUserStore.setState({ roles: ['admin'], permissions: ['*:*:*'] });
    roleApiMocks.listRole.mockResolvedValue({
      rows: [{ roleId: 2, roleName: '运维', roleKey: 'ops', roleSort: 2, status: '0', createTime: '2026-03-10 10:00:00' }],
      total: 1
    });
    roleApiMocks.getRole.mockResolvedValue(roleDetail());
    roleApiMocks.updateRole.mockResolvedValue(undefined);
    roleApiMocks.dataScope.mockResolvedValue(undefined);
    roleApiMocks.deptTreeSelect.mockResolvedValue({ data: { depts: deptTree, checkedKeys: ['101'] } });
    menuApiMocks.roleMenuTreeselect.mockResolvedValue({ data: { menus: menuTree, checkedKeys: ['11'] } });
  });

  const openEditDialog = async () => {
    renderWithRouter(<RolePage />, '/system/role');
    await screen.findByText('ops');
    fireEvent.click(screen.getAllByRole('button', { name: 'edit' })[0]);
    await screen.findByText('用户管理');
  };

  it('saves checked and half-checked menu keys when parent-child linkage is on', async () => {
    await openEditDialog();
    checkNode('角色管理');
    fireEvent.click(screen.getByRole('button', { name: 'OK' }));

    await waitFor(() => expect(roleApiMocks.updateRole).toHaveBeenCalledTimes(1));
    const payload = roleApiMocks.updateRole.mock.calls[0][0];
    // 两个子节点全选 => 父节点也全选；payload 不能丢失父级
    expect(sortedKeys(payload.menuIds)).toEqual(['1', '11', '12']);
    expect(payload).toMatchObject({ roleId: 2, menuCheckStrictly: true, deptCheckStrictly: true, roleKey: 'ops' });
  });

  it('keeps a half-checked parent in the saved menu keys even when the tree was not touched', async () => {
    await openEditDialog();
    fireEvent.click(screen.getByRole('button', { name: 'OK' }));

    await waitFor(() => expect(roleApiMocks.updateRole).toHaveBeenCalledTimes(1));
    expect(sortedKeys(roleApiMocks.updateRole.mock.calls[0][0].menuIds)).toEqual(['1', '11']);
  });

  it('saves exactly the checked keys when linkage is off and preserves the strictly flags', async () => {
    roleApiMocks.getRole.mockResolvedValue(roleDetail({ menuCheckStrictly: false, deptCheckStrictly: false }));
    menuApiMocks.roleMenuTreeselect.mockResolvedValue({ data: { menus: menuTree, checkedKeys: ['1', '11'] } });
    await openEditDialog();
    fireEvent.click(screen.getByRole('button', { name: 'OK' }));

    await waitFor(() => expect(roleApiMocks.updateRole).toHaveBeenCalledTimes(1));
    const payload = roleApiMocks.updateRole.mock.calls[0][0];
    expect(sortedKeys(payload.menuIds)).toEqual(['1', '11']);
    expect(payload).toMatchObject({ roleId: 2, menuCheckStrictly: false, deptCheckStrictly: false });
  });

  it('submits data scope with roleId, strictly flags and half-checked dept keys without opening the edit dialog', async () => {
    renderWithRouter(<RolePage />, '/system/role');
    await screen.findByText('ops');
    fireEvent.click(screen.getAllByRole('button', { name: 'check-circle' })[0]);
    const dialog = await screen.findByRole('dialog');
    await within(dialog).findByText('研发部');
    fireEvent.click(within(dialog).getByRole('button', { name: 'OK' }));

    await waitFor(() => expect(roleApiMocks.dataScope).toHaveBeenCalledTimes(1));
    const payload = roleApiMocks.dataScope.mock.calls[0][0];
    expect(payload).toMatchObject({ roleId: 2, roleName: '运维', roleKey: 'ops', dataScope: '2', menuCheckStrictly: true, deptCheckStrictly: true });
    expect(sortedKeys(payload.deptIds)).toEqual(['100', '101']);
  });
});
