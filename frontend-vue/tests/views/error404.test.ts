import { mount } from '@vue/test-utils';
import Error404View from '@/views/error/404.vue';

describe('views/error/404', () => {
  it('renders 404 message and return-home link', () => {
    const wrapper = mount(Error404View, {
      global: {
        stubs: {
          'router-link': {
            template: '<a class="router-link-stub"><slot /></a>'
          }
        }
      }
    });

    expect(wrapper.text()).toContain('404错误!');
    expect(wrapper.text()).toContain('找不到网页！');
    expect(wrapper.find('.router-link-stub').exists()).toBe(true);
  });
});
