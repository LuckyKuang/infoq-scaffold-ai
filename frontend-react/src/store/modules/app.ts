import { create } from 'zustand';

export type DeviceType = 'desktop' | 'mobile';
export type AppSize = 'large' | 'middle' | 'small';

const readPersistedSize = (): AppSize => {
  const persistedSize = localStorage.getItem('size');
  if (persistedSize === 'large' || persistedSize === 'middle' || persistedSize === 'small') {
    return persistedSize;
  }
  if (persistedSize === 'default') {
    return 'middle';
  }
  return 'middle';
};

type AppState = {
  sidebarOpened: boolean;
  sidebarHide: boolean;
  device: DeviceType;
  language: string;
  size: AppSize;
  toggleSideBar: () => void;
  closeSideBar: () => void;
  openSideBar: () => void;
  toggleDevice: (device: DeviceType) => void;
  toggleSideBarHide: (status: boolean) => void;
  changeLanguage: (language: string) => void;
  setSize: (size: AppSize) => void;
};

const sidebarStatus = localStorage.getItem('sidebarStatus');

export const useAppStore = create<AppState>((set) => ({
  sidebarOpened: sidebarStatus ? sidebarStatus === '1' : true,
  sidebarHide: false,
  device: 'desktop',
  language: localStorage.getItem('language') || 'zh_CN',
  size: readPersistedSize(),
  toggleSideBar: () =>
    set((state) => {
      const next = !state.sidebarOpened;
      localStorage.setItem('sidebarStatus', next ? '1' : '0');
      return { sidebarOpened: next };
    }),
  closeSideBar: () => {
    localStorage.setItem('sidebarStatus', '0');
    set({ sidebarOpened: false });
  },
  openSideBar: () => {
    localStorage.setItem('sidebarStatus', '1');
    set({ sidebarOpened: true });
  },
  toggleDevice: (device) => set({ device }),
  toggleSideBarHide: (status) => set({ sidebarHide: status }),
  changeLanguage: (language) => {
    localStorage.setItem('language', language);
    set({ language });
  },
  setSize: (size) => {
    localStorage.setItem('size', size);
    set({ size });
  }
}));
