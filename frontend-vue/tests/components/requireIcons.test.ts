import icons from '@/components/IconSelect/requireIcons';

describe('components/IconSelect/requireIcons', () => {
  it('collects icon names from svg assets directory', () => {
    expect(Array.isArray(icons)).toBe(true);
    expect(icons.length).toBeGreaterThan(10);

    const requiredIcons = ['fullscreen', 'exit-fullscreen', 'language', 'dashboard', 'user'];
    for (const name of requiredIcons) {
      expect(icons).toContain(name);
    }

    expect(icons.every((item) => !item.endsWith('.svg'))).toBe(true);
  });
});
