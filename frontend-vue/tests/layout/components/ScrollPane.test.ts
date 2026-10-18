import { mount } from '@vue/test-utils';
import { computed, defineComponent, h } from 'vue';
import ScrollPane from '@/layout/components/TagsView/ScrollPane.vue';

const scrollPaneMocks = vi.hoisted(() => ({
  wrapRef: {
    scrollLeft: 20,
    scrollWidth: 400,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn()
  },
  containerEl: {
    offsetWidth: 200
  },
  visitedViews: [] as Array<{ path: string; fullPath: string }>,
  storedScrollHandler: undefined as undefined | (() => void)
}));

vi.mock('@/store/modules/tagsView', () => ({
  useTagsViewStore: () => ({
    visitedViews: scrollPaneMocks.visitedViews
  })
}));

const ElScrollbarStub = defineComponent({
  name: 'ElScrollbar',
  emits: ['wheel'],
  setup(_, { slots, emit, expose }) {
    expose({
      $refs: {
        wrapRef: scrollPaneMocks.wrapRef
      },
      $el: scrollPaneMocks.containerEl
    });

    return () =>
      h(
        'div',
        {
          class: 'el-scrollbar-stub',
          onWheel: (event: WheelEvent) => emit('wheel', event)
        },
        slots.default?.()
      );
  }
});

describe('layout/components/TagsView/ScrollPane', () => {
  let getElementsSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    scrollPaneMocks.wrapRef.scrollLeft = 20;
    scrollPaneMocks.wrapRef.scrollWidth = 400;
    scrollPaneMocks.containerEl.offsetWidth = 200;
    scrollPaneMocks.visitedViews = [];
    scrollPaneMocks.storedScrollHandler = undefined;
    scrollPaneMocks.wrapRef.addEventListener.mockImplementation((event: string, handler: () => void) => {
      if (event === 'scroll') {
        scrollPaneMocks.storedScrollHandler = handler;
      }
    });
    getElementsSpy = vi.spyOn(document, 'getElementsByClassName').mockReturnValue([] as unknown as HTMLCollectionOf<Element>);
  });

  afterEach(() => {
    getElementsSpy.mockRestore();
  });

  const mountPane = () =>
    mount(ScrollPane, {
      global: {
        stubs: {
          'el-scrollbar': ElScrollbarStub
        }
      }
    });

  it('handles wheel scrolling and emits scroll event from wrapper listener', async () => {
    const wrapper = mountPane();
    await wrapper.find('.el-scrollbar-stub').trigger('wheel', { deltaY: 1 });

    expect(scrollPaneMocks.wrapRef.scrollLeft).toBe(10);
    expect(scrollPaneMocks.wrapRef.addEventListener).toHaveBeenCalledWith('scroll', expect.any(Function), true);

    scrollPaneMocks.storedScrollHandler?.();
    expect(wrapper.emitted('scroll')).toHaveLength(1);

    wrapper.unmount();
    expect(scrollPaneMocks.wrapRef.removeEventListener).toHaveBeenCalledWith('scroll', expect.any(Function));
  });

  it('moves to first/last/current tag based on target position', () => {
    const first = { path: '/a', fullPath: '/a' };
    const middle = { path: '/b', fullPath: '/b' };
    const last = { path: '/c', fullPath: '/c' };
    scrollPaneMocks.visitedViews = [first, middle, last];

    getElementsSpy.mockReturnValue([
      {
        dataset: { path: '/a' },
        offsetLeft: 40,
        offsetWidth: 80
      },
      {
        dataset: { path: '/c' },
        offsetLeft: 300,
        offsetWidth: 100
      }
    ] as unknown as HTMLCollectionOf<Element>);

    const wrapper = mountPane();
    const vm = wrapper.vm as unknown as {
      moveToTarget: (tag: { path: string; fullPath: string }) => void;
    };

    scrollPaneMocks.wrapRef.scrollLeft = 60;
    vm.moveToTarget(first);
    expect(scrollPaneMocks.wrapRef.scrollLeft).toBe(0);

    scrollPaneMocks.wrapRef.scrollLeft = 60;
    vm.moveToTarget(last);
    expect(scrollPaneMocks.wrapRef.scrollLeft).toBe(200);

    scrollPaneMocks.wrapRef.scrollLeft = 20;
    vm.moveToTarget(middle);
    expect(scrollPaneMocks.wrapRef.scrollLeft).toBe(204);
  });

  it('moves left when previous tag is out of view', () => {
    const first = { path: '/a', fullPath: '/a' };
    const middle = { path: '/b', fullPath: '/b' };
    const last = { path: '/c', fullPath: '/c' };
    scrollPaneMocks.visitedViews = [first, middle, last];
    scrollPaneMocks.wrapRef.scrollLeft = 180;

    getElementsSpy.mockReturnValue([
      {
        dataset: { path: '/a' },
        offsetLeft: 40,
        offsetWidth: 80
      },
      {
        dataset: { path: '/c' },
        offsetLeft: 200,
        offsetWidth: 40
      }
    ] as unknown as HTMLCollectionOf<Element>);

    const wrapper = mountPane();
    const vm = wrapper.vm as unknown as {
      moveToTarget: (tag: { path: string; fullPath: string }) => void;
    };

    vm.moveToTarget(middle);
    expect(scrollPaneMocks.wrapRef.scrollLeft).toBe(36);
  });
});
