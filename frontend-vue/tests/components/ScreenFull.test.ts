import { mount } from '@vue/test-utils';
import { defineComponent, h } from 'vue';
import ScreenFull from '@/components/ScreenFull/index.vue';

const screenFullMocks = vi.hoisted(() => ({
  fullscreen: false,
  toggle: vi.fn()
}));

vi.mock('@vueuse/core', () => ({
  useFullscreen: () => ({
    isFullscreen: screenFullMocks.fullscreen,
    toggle: screenFullMocks.toggle
  })
}));

const SvgIconStub = defineComponent({
  name: 'SvgIcon',
  props: {
    iconClass: {
      type: String,
      default: ''
    }
  },
  emits: ['click'],
  setup(props, { emit }) {
    return () =>
      h(
        'button',
        {
          class: 'svg-icon-stub',
          'data-icon': props.iconClass,
          onClick: (e: MouseEvent) => emit('click', e)
        },
        'icon'
      );
  }
});

describe('components/ScreenFull', () => {
  beforeEach(() => {
    screenFullMocks.fullscreen = false;
    screenFullMocks.toggle.mockClear();
  });

  it('renders icon by fullscreen status and toggles on click', async () => {
    const wrapper = mount(ScreenFull, {
      global: {
        stubs: {
          'svg-icon': SvgIconStub
        }
      }
    });

    expect(wrapper.find('.svg-icon-stub').attributes('data-icon')).toBe('fullscreen');

    await wrapper.find('.svg-icon-stub').trigger('click');
    expect(screenFullMocks.toggle).toHaveBeenCalledTimes(1);
  });
});
