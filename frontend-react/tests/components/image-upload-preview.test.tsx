import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const ossMocks = vi.hoisted(() => ({
  listByIds: vi.fn(),
  uploadOss: vi.fn(),
  delOss: vi.fn()
}));

vi.mock('@/api/system/oss', () => ossMocks);
vi.mock('@/utils/modal', () => ({
  default: { msgError: vi.fn(), msgSuccess: vi.fn(), loading: vi.fn(), closeLoading: vi.fn() }
}));

const { default: ImageUpload } = await import('@/components/ImageUpload');

describe('components/ImageUpload preview (real antd Image)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ossMocks.listByIds.mockResolvedValue({
      code: 200,
      data: [{ ossId: '1', originalName: 'demo.png', url: 'https://cdn.example.com/demo.png' }]
    });
  });

  it('opens the antd image preview on preview click and closes it through onOpenChange', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    render(<ImageUpload value="1" />);

    const previewAction = await screen.findByLabelText('Preview file');
    fireEvent.click(previewAction);

    // 预览层使用 open/onOpenChange：打开后能看到预览大图
    const dialog = await screen.findByRole('dialog');
    expect(dialog.querySelector('img.ant-image-preview-img')).toHaveAttribute('src', 'https://cdn.example.com/demo.png');

    // 点击关闭后组件应通过 onOpenChange(false) 清掉 preview，预览层不再保持打开
    fireEvent.click(dialog.querySelector('.ant-image-preview-close, [aria-label="Close"]') as HTMLElement);
    await waitFor(() => {
      expect(document.querySelector('.ant-image-preview-root')).toBeNull();
    });

    // 不再使用已废弃的 visible/onVisibleChange
    const deprecations = errorSpy.mock.calls.filter((call) => String(call[0]).includes('deprecated'));
    expect(deprecations).toEqual([]);
    errorSpy.mockRestore();
  });
});
