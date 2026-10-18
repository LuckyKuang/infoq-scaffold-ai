import { mount } from '@vue/test-utils';
import { defineComponent } from 'vue';
import { scrollTo } from '@/utils/scroll-to';
import Pagination from '@/components/Pagination/index.vue';

vi.mock('@/utils/scroll-to', () => ({
  scrollTo: vi.fn()
}));

const ElPaginationStub = defineComponent({
  name: 'ElPagination',
  emits: ['update:page-size', 'size-change', 'current-change'],
  template: `
    <div class="el-pagination-stub">
      <button class="size-btn" @click="$emit('update:page-size', 30); $emit('size-change', 30)">size</button>
      <button class="current-btn" @click="$emit('current-change', 3)">current</button>
    </div>
  `
});

describe('components/Pagination', () => {
  it('resets page and emits pagination when page size changes', async () => {
    const wrapper = mount(Pagination, {
      props: {
        total: 100,
        page: 5,
        limit: 20,
        autoScroll: true
      },
      global: {
        stubs: {
          'el-pagination': ElPaginationStub
        }
      }
    });

    await wrapper.find('.size-btn').trigger('click');

    expect(wrapper.emitted('update:limit')?.[0]).toEqual([30]);
    expect(wrapper.emitted('update:page')?.[0]).toEqual([1]);
    expect(wrapper.emitted('pagination')?.[0]).toEqual([{ page: 1, limit: 30 }]);
    expect(scrollTo).toHaveBeenCalledWith(0, 800);
  });

  it('emits pagination on current page change without auto scroll', async () => {
    const wrapper = mount(Pagination, {
      props: {
        total: 100,
        page: 1,
        limit: 20,
        autoScroll: false
      },
      global: {
        stubs: {
          'el-pagination': ElPaginationStub
        }
      }
    });

    await wrapper.find('.current-btn').trigger('click');

    expect(wrapper.emitted('pagination')?.[0]).toEqual([{ page: 3, limit: 20 }]);
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it('scrolls to top when current page changes and autoScroll is enabled', async () => {
    const wrapper = mount(Pagination, {
      props: {
        total: 100,
        page: 2,
        limit: 20,
        autoScroll: true
      },
      global: {
        stubs: {
          'el-pagination': ElPaginationStub
        }
      }
    });

    await wrapper.find('.current-btn').trigger('click');

    expect(wrapper.emitted('pagination')?.[0]).toEqual([{ page: 3, limit: 20 }]);
    expect(scrollTo).toHaveBeenCalledWith(0, 800);
  });

  it('applies hidden class when hidden prop is true', () => {
    const wrapper = mount(Pagination, {
      props: {
        total: 1,
        hidden: true
      },
      global: {
        stubs: {
          'el-pagination': ElPaginationStub
        }
      }
    });

    expect(wrapper.classes()).toContain('hidden');
  });
});
