import {fireEvent, screen, waitFor} from '@testing-library/react';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {renderWithRouter} from '../helpers/renderWithRouter';
import modal from '@/utils/modal';
import ConfigPage from '@/pages/system/config/index';

const panelFixture = {
  groups: [
    {
      groupKey: 'account',
      groupName: '账号与登录',
      displayOrder: 10,
      items: [
        {
          configId: 5,
          configName: '是否开启注册',
          configKey: 'sys.account.registerUser',
          configValue: 'true',
          configType: 'Y',
          valueType: 'switch',
          defaultValue: 'false',
          groupKey: 'account',
          displayOrder: 10,
          options: null,
          uiProps: {},
          editable: true,
          editableReason: null,
          remark: '关闭后公开注册不可访问',
        },
        {
          configId: 2,
          configName: '初始密码',
          configKey: 'sys.user.initPassword',
          configValue: '123456',
          configType: 'Y',
          valueType: 'password',
          defaultValue: '123456',
          groupKey: 'account',
          displayOrder: 40,
          options: null,
          uiProps: {},
          editable: true,
          editableReason: null,
          remark: '初始化密码',
        },
      ],
    },
    {
      groupKey: 'theme',
      groupName: '界面与主题',
      displayOrder: 20,
      items: [
        {
          configId: 3,
          configName: '侧边栏主题',
          configKey: 'sys.index.sideTheme',
          configValue: 'theme-light',
          configType: 'Y',
          valueType: 'select',
          defaultValue: 'theme-light',
          groupKey: 'theme',
          displayOrder: 10,
          options: [
            { label: '深色主题', value: 'theme-dark' },
            { label: '浅色主题', value: 'theme-light' },
          ],
          uiProps: {},
          editable: true,
          editableReason: null,
          remark: '深色主题theme-dark，浅色主题theme-light',
        },
      ],
    },
  ],
};

const deletePanelFixture = {
  groups: [
    {
      groupKey: 'advanced',
      groupName: '高级配置',
      displayOrder: 90,
      items: [
        {
          configId: 901,
          configName: 'E2E测试参数',
          configKey: 'e2e.config.key',
          configValue: 'before',
          configType: 'N',
          valueType: 'text',
          defaultValue: 'before',
          groupKey: 'advanced',
          displayOrder: 1,
          options: null,
          uiProps: {},
          editable: true,
          editableReason: null,
          remark: 'e2e 参数删除入口验证'
        }
      ]
    }
  ]
};

const largePanelFixture = {
  groups: [
    {
      ...panelFixture.groups[0],
      items: Array.from({ length: 12 }, (_, index) => ({
        ...panelFixture.groups[0].items[0],
        configId: 100 + index,
        configName: `分页配置${index + 1}`,
        configKey: `sys.page.${index + 1}`,
        configValue: `value-${index + 1}`,
        valueType: 'text',
        remark: `分页测试${index + 1}`,
      })),
    },
  ],
};

const configPageMocks = vi.hoisted(() => ({
  getConfigPanel: vi.fn(),
  addConfig: vi.fn(),
  delConfig: vi.fn(),
  updateConfig: vi.fn(),
  updateConfigByKey: vi.fn(),
  resetConfigByKey: vi.fn(),
  reorderConfig: vi.fn(),
  refreshCache: vi.fn(),
}));

vi.mock('@/api/system/config', () => ({
  getConfigPanel: configPageMocks.getConfigPanel,
  addConfig: configPageMocks.addConfig,
  delConfig: configPageMocks.delConfig,
  updateConfig: configPageMocks.updateConfig,
  updateConfigByKey: configPageMocks.updateConfigByKey,
  resetConfigByKey: configPageMocks.resetConfigByKey,
  reorderConfig: configPageMocks.reorderConfig,
  refreshCache: configPageMocks.refreshCache,
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

vi.mock('@/utils/request', async () => {
  const actual =
    await vi.importActual<typeof import('@/utils/request')>('@/utils/request');
  return {
    ...actual,
    download: vi.fn(),
  };
});

vi.mock('@/store/modules/user', () => ({
  useUserStore: (selector: (state: { roles: string[] }) => unknown) =>
    selector({ roles: ['superadmin'] }),
}));

describe('pages/system/config', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    configPageMocks.getConfigPanel.mockResolvedValue({ data: panelFixture });
    configPageMocks.updateConfigByKey.mockResolvedValue(undefined);
    configPageMocks.resetConfigByKey.mockResolvedValue({ data: 'false' });
    configPageMocks.reorderConfig.mockResolvedValue(undefined);
    configPageMocks.refreshCache.mockResolvedValue(undefined);
    configPageMocks.delConfig.mockResolvedValue(undefined);
  });

  it('loads config panel groups and typed items', async () => {
    const { container } = renderWithRouter(<ConfigPage />, '/system/config');

    expect(await screen.findByText('账号与登录')).toBeInTheDocument();
    expect(await screen.findByText('是否开启注册')).toBeInTheDocument();
    expect(await screen.findByText('初始密码')).toBeInTheDocument();
    expect(container.querySelectorAll('.config-setting-row')).toHaveLength(3);
    expect(container.querySelector('.config-list-panel')).toBeInTheDocument();
    expect(container.querySelector('.config-list-scroll')).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('搜索配置名称、键名或备注')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^刷新$/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '刷新缓存' })).toBeInTheDocument();
    expect(configPageMocks.getConfigPanel).toHaveBeenCalled();
  });

  it('reports malformed config panel instead of rendering empty groups', async () => {
    configPageMocks.getConfigPanel.mockResolvedValueOnce({ data: {} });

    renderWithRouter(<ConfigPage />, '/system/config');

    await waitFor(() => {
      expect(modal.msgError).toHaveBeenCalledWith(
        '配置面板响应 data.groups 必须是数组',
      );
    });
  });

  it('paginates the config list and scrolls the page', async () => {
    configPageMocks.getConfigPanel.mockResolvedValueOnce({
      data: largePanelFixture,
    });
    const { container } = renderWithRouter(<ConfigPage />, '/system/config');

    expect(await screen.findByText('分页配置1')).toBeInTheDocument();
    expect(container.querySelectorAll('.config-setting-row')).toHaveLength(5);
    expect(screen.queryByText('分页配置6')).not.toBeInTheDocument();

    const nextButton = container.querySelector<HTMLButtonElement>(
      '.ant-pagination-next button',
    );
    if (!nextButton) {
      throw new Error('Expected pagination next button to be rendered');
    }
    fireEvent.click(nextButton);

    await waitFor(() => {
      expect(screen.getByText('分页配置6')).toBeInTheDocument();
    });
    expect(container.querySelectorAll('.config-setting-row')).toHaveLength(5);

    fireEvent.click(nextButton);

    await waitFor(() => {
      expect(screen.getByText('分页配置11')).toBeInTheDocument();
    });
    expect(container.querySelectorAll('.config-setting-row')).toHaveLength(2);
  });

  it('updates switch config by key', async () => {
    renderWithRouter(<ConfigPage />, '/system/config');

    const registerSwitch = await screen.findByRole('switch', {
      name: '是否开启注册',
    });
    fireEvent.click(registerSwitch);

    await waitFor(() => {
      expect(configPageMocks.updateConfigByKey).toHaveBeenCalledWith(
        'sys.account.registerUser',
        false,
      );
    });
  });

  it('enters password edit mode without leaving the config card layout', async () => {
    const { container } = renderWithRouter(<ConfigPage />, '/system/config');

    await screen.findByText('初始密码');
    fireEvent.click(screen.getByRole('button', { name: /编辑/ }));

    expect(screen.getByDisplayValue('123456')).toBeInTheDocument();
    expect(
      container.querySelector('.config-card-main-editing'),
    ).toBeInTheDocument();
  }, 15000);

  it('restores default value by backend reset api', async () => {
    renderWithRouter(<ConfigPage />, '/system/config');

    const resetButtons = await screen.findAllByText('恢复默认');
    fireEvent.click(resetButtons[0]);

    await waitFor(() => {
      expect(configPageMocks.resetConfigByKey).toHaveBeenCalledWith(
        'sys.account.registerUser',
      );
    });
  });

  it('deletes a custom config definition through the visible remove entry', async () => {
    configPageMocks.getConfigPanel.mockResolvedValue({ data: deletePanelFixture });
    renderWithRouter(<ConfigPage />, '/system/config');

    expect(await screen.findByText('E2E测试参数')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /删除/ }));

    await waitFor(() => {
      expect(modal.confirm).toHaveBeenCalledWith('是否确认删除参数键名为 "e2e.config.key" 的配置定义？');
      expect(configPageMocks.delConfig).toHaveBeenCalledWith(901);
    });
  });

});
