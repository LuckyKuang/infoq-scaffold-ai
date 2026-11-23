import { render, screen } from '@testing-library/react';
import CrudModal from '@/components/CrudModal';

describe('components/CrudModal', () => {
  it('centers CRUD dialogs and constrains body overflow by default', () => {
    render(
      <CrudModal open title="新增测试弹框">
        <div>测试内容</div>
      </CrudModal>
    );

    expect(screen.getByText('新增测试弹框')).toBeInTheDocument();

    const wrapper = document.querySelector('.ant-modal-centered');
    expect(wrapper).toBeInTheDocument();

    const body = document.querySelector('.ant-modal-body') as HTMLElement | null;
    expect(body).toBeInTheDocument();
    // jsdom resolves calc(90vh - 120px) against its viewport, so assert the resolved pixel value.
    expect(parseFloat(getComputedStyle(body as HTMLElement).maxHeight)).toBeCloseTo(window.innerHeight * 0.9 - 120, 5);
    expect(body).toHaveStyle({
      overflowY: 'auto',
      overflowX: 'hidden'
    });
  });
});
