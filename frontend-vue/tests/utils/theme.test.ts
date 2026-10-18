import { getDarkColor, getLightColor, handleThemeStyle, hexToRgb, rgbToHex } from '@/utils/theme';

describe('utils/theme', () => {
  it('converts between hex and rgb', () => {
    expect(hexToRgb('#ffffff')).toEqual(['255', '255', '255']);
    expect(hexToRgb('#000000')).toEqual(['0', '0', '0']);
    expect(rgbToHex('255', '0', '16')).toBe('#ff0010');
  });

  it('calculates light and dark colors', () => {
    expect(getLightColor('#000000', 0.5)).toBe('#7f7f7f');
    expect(getDarkColor('#ffffff', 0.5)).toBe('#7f7f7f');
  });

  it('writes full primary color palette css variables', () => {
    const setPropertySpy = vi.spyOn(document.documentElement.style, 'setProperty');

    handleThemeStyle('#409eff');

    expect(setPropertySpy).toHaveBeenCalledWith('--el-color-primary', '#409eff');
    expect(setPropertySpy).toHaveBeenCalledTimes(19);
    setPropertySpy.mockRestore();
  });
});
