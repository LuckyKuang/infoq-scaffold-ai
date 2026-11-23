import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { renderWithRouter } from '../../helpers/renderWithRouter';
import { useUserStore } from '@/store/modules/user';

const requestMock = vi.hoisted(() => vi.fn());

vi.mock('@/utils/request', () => ({
  default: requestMock,
  download: vi.fn()
}));

vi.mock('@/hooks/useDictOptions', () => ({
  default: (...types: string[]) => Object.fromEntries(types.map((type) => [type, []]))
}));

vi.mock('@/components/Pagination', () => ({
  default: () => <div data-testid="pagination" />
}));

vi.mock('@/components/RightToolbar', () => ({
  default: () => <div data-testid="right-toolbar" />
}));

vi.mock('@/utils/modal', () => ({
  default: {
    confirm: vi.fn().mockResolvedValue(true),
    msgSuccess: vi.fn(),
    msgWarning: vi.fn(),
    msgError: vi.fn(),
    loading: vi.fn(),
    closeLoading: vi.fn()
  }
}));

vi.mock('@/api/system/user', () => ({
  listUser: vi.fn().mockResolvedValue({ rows: [], total: 0 }),
  deptTreeSelect: vi.fn().mockResolvedValue({ data: [] }),
  addUser: vi.fn(),
  changeUserStatus: vi.fn(),
  delUser: vi.fn(),
  getUser: vi.fn(),
  resetUserPwd: vi.fn(),
  updateUser: vi.fn()
}));

vi.mock('@/api/system/role', () => ({
  listRole: vi.fn().mockResolvedValue({ rows: [], total: 0 })
}));

vi.mock('@/api/system/post', () => ({
  optionselect: vi.fn().mockResolvedValue({ data: [] })
}));

const { default: UserPage } = await import('@/pages/system/user/index');
const userApi = await import('@/api/system/user');
const roleApi = await import('@/api/system/role');
const postApi = await import('@/api/system/post');

describe('pages/system/user import result', () => {
  beforeEach(() => {
    requestMock.mockReset();
    vi.mocked(userApi.listUser).mockResolvedValue({ rows: [], total: 0 } as never);
    vi.mocked(userApi.deptTreeSelect).mockResolvedValue({ data: [] } as never);
    vi.mocked(roleApi.listRole).mockResolvedValue({ rows: [], total: 0 } as never);
    vi.mocked(postApi.optionselect).mockResolvedValue({ data: [] } as never);
    useUserStore.setState({ roles: ['admin'], permissions: ['*:*:*'] });
  });

  it('renders backend import lines as text so account names from the xlsx cannot inject HTML', async () => {
    requestMock.mockResolvedValue({
      code: 200,
      msg: '恭喜您，数据已全部导入成功！共 1 条，数据如下：<br/>1、账号 <img src=x onerror="window.__pwned=1"> 导入成功'
    });
    renderWithRouter(<UserPage />, '/system/user');

    fireEvent.mouseEnter(await screen.findByText('更多'));
    fireEvent.click(await screen.findByText('导入数据'));
    const input = (await waitFor(() => {
      const node = document.querySelector('input[type="file"]');
      expect(node).not.toBeNull();
      return node;
    })) as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File(['x'], 'users.xlsx')] } });
    fireEvent.click(await screen.findByRole('button', { name: '确 定' }));

    expect((await screen.findAllByText('导入结果')).length).toBeGreaterThan(0);
    expect(screen.getByText('1、账号 <img src=x onerror="window.__pwned=1"> 导入成功')).toBeInTheDocument();
    expect(screen.getByText('恭喜您，数据已全部导入成功！共 1 条，数据如下：')).toBeInTheDocument();
    expect(document.body.querySelector('img[src="x"]')).toBeNull();
  });
});
