import { create } from 'zustand';

export interface NoticeItem {
  message: string;
  read: boolean;
  time: string;
}

type NoticeState = {
  notices: NoticeItem[];
  addNotice: (notice: NoticeItem) => void;
  markRead: (index: number) => void;
  markAllRead: () => void;
  clearNotices: () => void;
};

export const useNoticeStore = create<NoticeState>((set) => ({
  notices: [],
  addNotice: (notice) =>
    set((state) => ({ notices: [notice, ...state.notices] })),
  markRead: (index) =>
    set((state) => ({
      notices: state.notices.map((item, currentIndex) =>
        currentIndex === index ? { ...item, read: true } : item,
      ),
    })),
  markAllRead: () =>
    set((state) => ({
      notices: state.notices.map((item) => ({ ...item, read: true })),
    })),
  clearNotices: () => set({ notices: [] }),
}));
