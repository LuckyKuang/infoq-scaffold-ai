import animate from '@/animate';

describe('animate config', () => {
  it('exposes a non-empty animation list and default values', () => {
    expect(Array.isArray(animate.animateList)).toBe(true);
    expect(animate.animateList.length).toBeGreaterThan(5);
    expect(animate.defaultAnimate).toBe('animate__animated animate__fadeIn');
  });

  it('uses prefixed class names for all animation sections', () => {
    expect(animate.animateList.every((item) => item.startsWith('animate__animated '))).toBe(true);
    expect(animate.menuSearchAnimate.enter.startsWith('animate__animated ')).toBe(true);
    expect(animate.menuSearchAnimate.leave.startsWith('animate__animated ')).toBe(true);
    expect(animate.logoAnimate.enter.startsWith('animate__animated ')).toBe(true);
    expect(animate.logoAnimate.leave.startsWith('animate__animated ')).toBe(true);
    expect(animate.searchAnimate).toEqual({
      enter: '',
      leave: ''
    });
  });
});
