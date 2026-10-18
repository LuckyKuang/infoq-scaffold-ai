import { mount } from '@vue/test-utils';
import Hamburger from '@/components/Hamburger/index.vue';

describe('components/Hamburger', () => {
  it('renders active class and emits toggle event when clicked', async () => {
    const wrapper = mount(Hamburger, {
      props: {
        isActive: true
      }
    });

    expect(wrapper.find('svg').classes()).toContain('is-active');

    await wrapper.find('div').trigger('click');
    expect(wrapper.emitted('toggleClick')).toBeTruthy();
    expect(wrapper.emitted('toggleClick')).toHaveLength(1);
  });
});
