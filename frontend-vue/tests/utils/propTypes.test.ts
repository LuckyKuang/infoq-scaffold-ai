import ProjectTypes, { propTypes } from '@/utils/propTypes';

type DefaultablePropType = {
  def: (value: string) => {
    default: string;
  };
};

type ProjectTypeSet = {
  style: {
    type: unknown[];
    default: unknown;
  };
};

describe('utils/propTypes', () => {
  it('exposes commonly used vue-types helpers', () => {
    expect(propTypes.string).toBeDefined();
    expect(propTypes.number).toBeDefined();
    expect(propTypes.bool).toBeDefined();
    expect(propTypes.object).toBeDefined();
    expect(propTypes.func).toBeDefined();
    expect(propTypes.integer).toBeDefined();

    const stringWithDefault = (propTypes.string as DefaultablePropType).def('fallback');
    expect(stringWithDefault.default).toBe('fallback');
  });

  it('provides style validable type on ProjectTypes', () => {
    const styleType = (ProjectTypes as ProjectTypeSet).style;
    expect(styleType).toBeTruthy();
    expect(styleType.type).toEqual([String, Object]);
    expect(styleType.default).toBeUndefined();
  });
});
