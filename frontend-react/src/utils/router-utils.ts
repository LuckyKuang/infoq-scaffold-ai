let navigator: ((path: string) => void) | null = null;

export const setNavigator = (fn: (path: string) => void) => {
  navigator = fn;
};

export const navigateTo = (path: string) => {
  navigator?.(path);
};
