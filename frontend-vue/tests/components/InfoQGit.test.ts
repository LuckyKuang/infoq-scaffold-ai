import { mount } from '@vue/test-utils';
import { defineComponent, h } from 'vue';
import InfoQGit from '@/components/InfoQGit/index.vue';

const SvgIconStub = defineComponent({
  name: 'SvgIcon',
  emits: ['click'],
  setup(_, { emit }) {
    return () =>
      h(
        'button',
        {
          class: 'svg-icon-stub',
          onClick: () => emit('click')
        },
        'git'
      );
  }
});

describe('components/InfoQGit', () => {
  it('opens project github url on icon click', async () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

    const wrapper = mount(InfoQGit, {
      global: {
        stubs: {
          'svg-icon': SvgIconStub
        }
      }
    });

    await wrapper.find('button.svg-icon-stub').trigger('click');
    expect(openSpy).toHaveBeenCalledWith('https://github.com/luckykuang/infoq-scaffold-ai');

    openSpy.mockRestore();
  });
});
