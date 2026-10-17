import { mount } from '@vue/test-utils';
import { defineComponent, h } from 'vue';
import Error401View from '@/views/error/401.vue';

const ElButtonStub = defineComponent({
  name: 'ElButton',
  emits: ['click'],
  setup(_, { emit, slots }) {
    return () =>
      h(
        'button',
        {
          class: 'back-btn',
          onClick: () => emit('click')
        },
        slots.default?.()
      );
  }
});

describe('views/error/401', () => {
  it('goes back when noGoBack query is not provided', async () => {
    const router = {
      push: vi.fn(),
      go: vi.fn()
    };

    const wrapper = mount(Error401View, {
      global: {
        config: {
          globalProperties: {
            $route: { query: {} },
            $router: router
          } as unknown as import('vue').ComponentCustomProperties & Record<string, unknown>
        },
        stubs: {
          'el-button': ElButtonStub,
          'el-row': true,
          'el-col': true,
          'router-link': true
        }
      }
    });

    await wrapper.find('button.back-btn').trigger('click');
    expect(router.go).toHaveBeenCalledWith(-1);
    expect(router.push).not.toHaveBeenCalled();
  });

  it('redirects to home when noGoBack is true', async () => {
    const router = {
      push: vi.fn(),
      go: vi.fn()
    };

    const wrapper = mount(Error401View, {
      global: {
        config: {
          globalProperties: {
            $route: { query: { noGoBack: 'true' } },
            $router: router
          } as unknown as import('vue').ComponentCustomProperties & Record<string, unknown>
        },
        stubs: {
          'el-button': ElButtonStub,
          'el-row': true,
          'el-col': true,
          'router-link': true
        }
      }
    });

    await wrapper.find('button.back-btn').trigger('click');
    expect(router.push).toHaveBeenCalledWith({ path: '/' });
  });
});
