import { create } from 'zustand';

export interface TagView {
  fullPath: string;
  name: string;
  path: string;
  title: string;
  icon?: string;
  noCache?: boolean;
  affix?: boolean;
}

type TagsViewState = {
  visitedViews: TagView[];
  cachedViews: string[];
  addView: (view: TagView) => void;
  addCachedView: (view: TagView) => void;
  delCachedView: (path: string) => void;
  delView: (path: string) => void;
  delLeftViews: (path: string) => void;
  delRightViews: (path: string) => void;
  delOthersViews: (path: string) => void;
  delAllViews: () => void;
  markAffixView: (views: TagView[]) => void;
};

const sameTagView = (a: TagView, b: TagView) =>
  a.fullPath === b.fullPath &&
  a.name === b.name &&
  a.path === b.path &&
  a.title === b.title &&
  a.icon === b.icon &&
  a.noCache === b.noCache &&
  a.affix === b.affix;

const normalizeTagPath = (path: string) => path.replace(/\/+/g, '/').replace(/\/$/, '') || '/';

const isHomeTag = (view: TagView) => {
  const normalizedPath = normalizeTagPath(view.path);
  return normalizedPath === '/index' || normalizedPath === '/';
};

const normalizeVisitedOrder = (views: TagView[]) => {
  const homeViews: TagView[] = [];
  const affixViews: TagView[] = [];
  const normalViews: TagView[] = [];

  views.forEach((view) => {
    if (isHomeTag(view)) {
      homeViews.push({
        ...view,
        affix: true
      });
      return;
    }
    if (view.affix) {
      affixViews.push(view);
      return;
    }
    normalViews.push(view);
  });

  return [...homeViews, ...affixViews, ...normalViews];
};

const dedupeVisited = (views: TagView[], next: TagView) => {
  const incomingPath = normalizeTagPath(next.path);
  const normalizedNext: TagView = {
    ...next,
    path: incomingPath,
    affix: next.affix || isHomeTag(next)
  };
  const index = views.findIndex((item) => normalizeTagPath(item.path) === incomingPath);
  if (index < 0) {
    return normalizeVisitedOrder([...views, normalizedNext]);
  }
  const merged = {
    ...views[index],
    ...normalizedNext,
    path: incomingPath,
    affix: views[index].affix || normalizedNext.affix || isHomeTag(normalizedNext)
  };
  if (sameTagView(views[index], merged)) {
    return normalizeVisitedOrder(views);
  }
  const nextViews = [...views];
  nextViews[index] = merged;
  return normalizeVisitedOrder(nextViews);
};

const dedupeCached = (cachedViews: string[], view: TagView) => {
  if (view.noCache) {
    return cachedViews;
  }
  if (cachedViews.includes(view.name)) {
    return cachedViews;
  }
  return [...cachedViews, view.name];
};

export const useTagsViewStore = create<TagsViewState>((set) => ({
  visitedViews: [],
  cachedViews: [],
  addView: (view) => {
    set((state) => ({
      visitedViews: dedupeVisited(state.visitedViews, view),
      cachedViews: dedupeCached(state.cachedViews, view)
    }));
  },
  addCachedView: (view) => {
    set((state) => ({
      cachedViews: dedupeCached(state.cachedViews, view)
    }));
  },
  delCachedView: (path) => {
    set((state) => {
      const target = state.visitedViews.find((item) => item.path === path);
      if (!target) {
        return {};
      }
      return {
        cachedViews: state.cachedViews.filter((item) => item !== target.name)
      };
    });
  },
  delView: (path) => {
    set((state) => {
      const target = state.visitedViews.find((item) => item.path === path);
      const visitedViews = state.visitedViews.filter((item) => item.path !== path || item.affix);
      const cachedViews = target ? state.cachedViews.filter((item) => item !== target.name) : state.cachedViews;
      return {
        visitedViews,
        cachedViews
      };
    });
  },
  delLeftViews: (path) => {
    set((state) => {
      const index = state.visitedViews.findIndex((item) => item.path === path);
      if (index < 0) {
        return {};
      }
      const removedNames = new Set(
        state.visitedViews
          .slice(0, index)
          .filter((item) => !item.affix)
          .map((item) => item.name)
      );
      const visitedViews = state.visitedViews.filter((item, idx) => idx >= index || item.affix);
      const cachedViews = state.cachedViews.filter((item) => !removedNames.has(item));
      return {
        visitedViews,
        cachedViews
      };
    });
  },
  delRightViews: (path) => {
    set((state) => {
      const index = state.visitedViews.findIndex((item) => item.path === path);
      if (index < 0) {
        return {};
      }
      const removedNames = new Set(
        state.visitedViews
          .slice(index + 1)
          .filter((item) => !item.affix)
          .map((item) => item.name)
      );
      const visitedViews = state.visitedViews.filter((item, idx) => idx <= index || item.affix);
      const cachedViews = state.cachedViews.filter((item) => !removedNames.has(item));
      return {
        visitedViews,
        cachedViews
      };
    });
  },
  delOthersViews: (path) => {
    set((state) => {
      const active = state.visitedViews.find((item) => item.path === path);
      const visitedViews = state.visitedViews.filter((item) => item.affix || item.path === path);
      const cachedViews = active && !active.noCache ? [active.name] : [];
      return {
        visitedViews,
        cachedViews
      };
    });
  },
  delAllViews: () => {
    set((state) => ({
      visitedViews: state.visitedViews.filter((item) => item.affix),
      cachedViews: []
    }));
  },
  markAffixView: (views) => {
    set((state) => {
      const affixPaths = new Set(views.map((item) => item.path));
      const next = state.visitedViews.map((item) => ({
        ...item,
        affix: item.affix || affixPaths.has(item.path)
      }));
      return {
        visitedViews: next
      };
    });
  }
}));
