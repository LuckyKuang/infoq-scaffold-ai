import { render, screen } from '@testing-library/react';
import CrudModal from '@/components/CrudModal';

describe('components/CrudModal', () => {
  it('centers business dialogs and constrains body overflow by default', () => {
    render(
      <CrudModal open title="新增测试弹框">
        <div>测试内容</div>
      </CrudModal>,
    );

    expect(screen.getByText('新增测试弹框')).toBeInTheDocument();

    const wrapper = document.querySelector('.ant-modal-centered');
    expect(wrapper).toBeInTheDocument();

    const body = document.querySelector(
      '.ant-modal-body',
    ) as HTMLElement | null;
    expect(body).toBeInTheDocument();
    expect(body?.getAttribute('style')).toContain(
      'max-height: calc(90vh - 120px)',
    );
    expect(body?.getAttribute('style')).toContain('overflow-y: auto');
    expect(body?.getAttribute('style')).toContain('overflow-x: hidden');
  });
});
