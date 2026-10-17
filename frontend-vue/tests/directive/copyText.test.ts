import copyText from '@/directive/common/copyText';
import type { DirectiveBinding } from 'vue';

type CopyBindingValue = string | ((value: string) => void);
type CopyTextElement = HTMLElement & {
  $destroyCopy?: () => void;
};

const createBinding = (value: CopyBindingValue, arg?: string) =>
  ({
    value,
    arg
  }) as unknown as DirectiveBinding<CopyBindingValue>;

describe('directive/copyText', () => {
  it('binds click handler and executes callback', () => {
    const el = document.createElement('button') as CopyTextElement;
    const callback = vi.fn();
    const execSpy = vi.spyOn(document, 'execCommand').mockReturnValue(true as never);

    copyText.beforeMount?.(el, createBinding('hello'));
    copyText.beforeMount?.(el, createBinding(callback, 'callback'));

    el.click();

    expect(execSpy).toHaveBeenCalledWith('copy');
    expect(callback).toHaveBeenCalledWith('hello');
    el.$destroyCopy();

    execSpy.mockRestore();
  });

  it('handles copy exception gracefully', () => {
    const el = document.createElement('button') as CopyTextElement;
    vi.spyOn(document, 'execCommand').mockImplementation(() => {
      throw new Error('copy failed');
    });
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    copyText.beforeMount?.(el, createBinding('x'));
    el.click();

    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
    vi.restoreAllMocks();
  });

  it('restores selection range after copy', () => {
    const el = document.createElement('button') as CopyTextElement;
    const range = {} as Range;
    const selection = {
      rangeCount: 1,
      getRangeAt: vi.fn(() => range),
      removeAllRanges: vi.fn(),
      addRange: vi.fn()
    };
    const getSelectionSpy = vi.spyOn(document, 'getSelection').mockReturnValue(selection as unknown as Selection);
    const execSpy = vi.spyOn(document, 'execCommand').mockReturnValue(true as never);

    copyText.beforeMount?.(el, createBinding('restore-range'));
    el.click();

    expect(selection.removeAllRanges).toHaveBeenCalledTimes(1);
    expect(selection.addRange).toHaveBeenCalledWith(range);
    getSelectionSpy.mockRestore();
    execSpy.mockRestore();
  });
});
