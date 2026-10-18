import { create } from 'zustand';

export type LayoutSetting = {
  theme: string;
  sideTheme: string;
  topNav: boolean;
  tagsView: boolean;
  tagsIcon: boolean;
  fixedHeader: boolean;
  sidebarLogo: boolean;
  dynamicTitle: boolean;
  dark: boolean;
};

export const defaultLayoutSettings: LayoutSetting = {
  theme: '#409EFF',
  sideTheme: 'theme-dark',
  topNav: false,
  tagsView: true,
  tagsIcon: false,
  fixedHeader: false,
  sidebarLogo: true,
  dynamicTitle: false,
  dark: false
};

export const normalizeThemeColor = (theme?: string | null): string => {
  if (!theme) {
    return defaultLayoutSettings.theme;
  }

  const value = theme.trim();
  const hexMatch = value.match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hexMatch) {
    const normalized = hexMatch[1].length === 3
      ? hexMatch[1]
          .split('')
          .map((char) => char + char)
          .join('')
      : hexMatch[1];
    return `#${normalized.toUpperCase()}`;
  }

  const rgbMatch = value.match(
    /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})(?:\s*,\s*(?:0|1|0?\.\d+))?\s*\)$/i
  );
  if (rgbMatch) {
    const hex = rgbMatch
      .slice(1, 4)
      .map((channel) => Math.max(0, Math.min(255, Number(channel))))
      .map((channel) => channel.toString(16).padStart(2, '0').toUpperCase())
      .join('');
    return `#${hex}`;
  }

  return defaultLayoutSettings.theme;
};

type SettingsState = {
  title: string;
  theme: string;
  sideTheme: string;
  showSettings: boolean;
  topNav: boolean;
  tagsView: boolean;
  tagsIcon: boolean;
  fixedHeader: boolean;
  sidebarLogo: boolean;
  dynamicTitle: boolean;
  animationEnable: boolean;
  dark: boolean;
  setTitle: (title: string) => void;
  setTheme: (theme: string) => void;
  setSideTheme: (sideTheme: string) => void;
  toggleTopNav: (enabled: boolean) => void;
  toggleTagsView: (enabled: boolean) => void;
  toggleTagsIcon: (enabled: boolean) => void;
  toggleFixedHeader: (enabled: boolean) => void;
  toggleSidebarLogo: (enabled: boolean) => void;
  toggleDynamicTitle: (enabled: boolean) => void;
  toggleDark: (enabled: boolean) => void;
  resetSettings: () => void;
};

const readPersisted = () => {
  try {
    return JSON.parse(localStorage.getItem('layout-setting') || '{}') as Partial<LayoutSetting>;
  } catch {
    return {};
  }
};

const persist = (state: SettingsState) => {
  const payload: LayoutSetting = {
    theme: normalizeThemeColor(state.theme),
    sideTheme: state.sideTheme,
    topNav: state.topNav,
    tagsView: state.tagsView,
    tagsIcon: state.tagsIcon,
    fixedHeader: state.fixedHeader,
    sidebarLogo: state.sidebarLogo,
    dynamicTitle: state.dynamicTitle,
    dark: state.dark
  };
  localStorage.setItem('layout-setting', JSON.stringify(payload));
};

const persisted = readPersisted();
const createSettingsState = (current: Partial<SettingsState> = {}) => ({
  ...current,
  theme: normalizeThemeColor(persisted.theme),
  sideTheme: persisted.sideTheme ?? defaultLayoutSettings.sideTheme,
  topNav: persisted.topNav ?? defaultLayoutSettings.topNav,
  tagsView: persisted.tagsView ?? defaultLayoutSettings.tagsView,
  tagsIcon: persisted.tagsIcon ?? defaultLayoutSettings.tagsIcon,
  fixedHeader: persisted.fixedHeader ?? defaultLayoutSettings.fixedHeader,
  sidebarLogo: persisted.sidebarLogo ?? defaultLayoutSettings.sidebarLogo,
  dynamicTitle: persisted.dynamicTitle ?? defaultLayoutSettings.dynamicTitle,
  dark: persisted.dark ?? defaultLayoutSettings.dark
});

export const useSettingsStore = create<SettingsState>((set) => ({
  title: import.meta.env.VITE_APP_TITLE,
  theme: createSettingsState().theme,
  sideTheme: createSettingsState().sideTheme,
  showSettings: true,
  topNav: createSettingsState().topNav,
  tagsView: createSettingsState().tagsView,
  tagsIcon: createSettingsState().tagsIcon,
  fixedHeader: createSettingsState().fixedHeader,
  sidebarLogo: createSettingsState().sidebarLogo,
  dynamicTitle: createSettingsState().dynamicTitle,
  animationEnable: false,
  dark: createSettingsState().dark,
  setTitle: (title) => set({ title }),
  setTheme: (theme) =>
    set((state) => {
      const next = { ...state, theme: normalizeThemeColor(theme) };
      persist(next);
      return next;
    }),
  setSideTheme: (sideTheme) =>
    set((state) => {
      const next = { ...state, sideTheme };
      persist(next);
      return next;
    }),
  toggleTopNav: (enabled) =>
    set((state) => {
      const next = { ...state, topNav: enabled };
      persist(next);
      return next;
    }),
  toggleTagsView: (enabled) =>
    set((state) => {
      const next = { ...state, tagsView: enabled };
      persist(next);
      return next;
    }),
  toggleTagsIcon: (enabled) =>
    set((state) => {
      const next = { ...state, tagsIcon: enabled };
      persist(next);
      return next;
    }),
  toggleFixedHeader: (enabled) =>
    set((state) => {
      const next = { ...state, fixedHeader: enabled };
      persist(next);
      return next;
    }),
  toggleSidebarLogo: (enabled) =>
    set((state) => {
      const next = { ...state, sidebarLogo: enabled };
      persist(next);
      return next;
    }),
  toggleDynamicTitle: (enabled) =>
    set((state) => {
      const next = { ...state, dynamicTitle: enabled };
      persist(next);
      return next;
    }),
  toggleDark: (enabled) =>
    set((state) => {
      const next = { ...state, dark: enabled };
      persist(next);
      return next;
    }),
  resetSettings: () =>
    set((state) => {
      const next = {
        ...state,
        ...defaultLayoutSettings
      };
      persist(next);
      return next;
    })
}));
