import { Tabs, theme } from 'antd';
import type { TabsProps } from 'antd';
import { CloseCircleOutlined, CloseOutlined, LeftOutlined, ReloadOutlined, RightOutlined } from '@ant-design/icons';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import SvgIcon from '@/components/SvgIcon';
import { useSettingsStore } from '@/store/modules/settings';
import type { TagView } from '@/store/modules/tagsView';
import { useTagsViewStore } from '@/store/modules/tagsView';

type TagsViewBarProps = {
  activePath: string;
};

export default function TagsViewBar({ activePath }: TagsViewBarProps) {
  const navigate = useNavigate();
  const visitedViews = useTagsViewStore((state) => state.visitedViews);
  const tagsIcon = useSettingsStore((state) => state.tagsIcon);
  const delCachedView = useTagsViewStore((state) => state.delCachedView);
  const delView = useTagsViewStore((state) => state.delView);
  const delLeftViews = useTagsViewStore((state) => state.delLeftViews);
  const delRightViews = useTagsViewStore((state) => state.delRightViews);
  const delOthersViews = useTagsViewStore((state) => state.delOthersViews);
  const delAllViews = useTagsViewStore((state) => state.delAllViews);
  const [menuVisible, setMenuVisible] = useState(false);
  const [selectedPath, setSelectedPath] = useState<string>('');
  const [menuPosition, setMenuPosition] = useState({ left: 0, top: 0 });
  const {
    token: { colorBgContainer, colorBorderSecondary }
  } = theme.useToken();

  const selectedView = useMemo(() => visitedViews.find((item) => item.path === selectedPath), [selectedPath, visitedViews]);
  const selectedIndex = useMemo(
    () => visitedViews.findIndex((item) => item.path === selectedView?.path),
    [selectedView?.path, visitedViews]
  );

  useEffect(() => {
    if (!menuVisible) {
      return;
    }
    const closeMenu = () => {
      setMenuVisible(false);
    };
    document.body.addEventListener('click', closeMenu);
    window.addEventListener('resize', closeMenu);
    window.addEventListener('scroll', closeMenu, true);
    return () => {
      document.body.removeEventListener('click', closeMenu);
      window.removeEventListener('resize', closeMenu);
      window.removeEventListener('scroll', closeMenu, true);
    };
  }, [menuVisible]);

  const navigateToLatest = () => {
    const latest = useTagsViewStore.getState().visitedViews.slice(-1)[0];
    navigate(latest?.path || '/index');
  };

  const handleRefresh = (view: TagView) => {
    delCachedView(view.path);
    const fullPath = view.fullPath || view.path;
    const target = fullPath.startsWith('/') ? fullPath : `/${fullPath}`;
    navigate(`/redirect${target}`);
  };

  const handleCloseCurrent = (view: TagView) => {
    if (view.affix) {
      return;
    }
    delView(view.path);
    if (view.path === activePath) {
      navigateToLatest();
    }
  };

  const handleCloseOthers = (view: TagView) => {
    delOthersViews(view.path);
    navigate(view.path);
  };

  const handleCloseLeft = (view: TagView) => {
    delLeftViews(view.path);
    const hasCurrent = useTagsViewStore.getState().visitedViews.some((item) => item.path === activePath);
    if (!hasCurrent) {
      navigate(view.path);
    }
  };

  const handleCloseRight = (view: TagView) => {
    delRightViews(view.path);
    const hasCurrent = useTagsViewStore.getState().visitedViews.some((item) => item.path === activePath);
    if (!hasCurrent) {
      navigateToLatest();
    }
  };

  const handleCloseAll = () => {
    delAllViews();
    navigateToLatest();
  };

  const openMenu = useCallback((view: TagView, event: ReactMouseEvent<HTMLSpanElement>) => {
    event.preventDefault();
    const menuMinWidth = 120;
    const maxLeft = Math.max(window.innerWidth - menuMinWidth - 12, 0);
    setMenuPosition({
      left: Math.min(event.clientX, maxLeft),
      top: event.clientY
    });
    setSelectedPath(view.path);
    setMenuVisible(true);
  }, []);

  const items = useMemo<TabsProps['items']>(
    () =>
      visitedViews.map((view) => ({
        key: view.path,
        label: (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }} onContextMenu={(event) => openMenu(view, event)}>
            {tagsIcon && view.icon ? <SvgIcon iconClass={view.icon} size={14} title={view.title || view.name} /> : null}
            <span>{view.title || view.name}</span>
          </span>
        ),
        closable: !view.affix
      })),
    [openMenu, tagsIcon, visitedViews]
  );

  return (
    <div
      className="tags-view-container"
      data-testid="tags-view-bar"
      style={{
        border: `1px solid ${colorBorderSecondary}`,
        background: colorBgContainer,
        padding: '0 8px',
        display: 'flex',
        alignItems: 'center'
      }}
    >
      <Tabs
        className="tags-view-tabs"
        style={{ flex: 1, minWidth: 0 }}
        type="editable-card"
        hideAdd
        items={items}
        activeKey={activePath}
        onChange={(key) => {
          navigate(key);
        }}
        onEdit={(targetKey, action) => {
          if (action !== 'remove') {
            return;
          }
          const key = String(targetKey);
          delView(key);
          if (key === activePath) {
            navigateToLatest();
          }
        }}
      />
      {menuVisible && selectedView ? (
        <ul
          className="tags-view-contextmenu"
          style={{
            left: `${menuPosition.left}px`,
            top: `${menuPosition.top}px`
          }}
          onClick={(event) => {
            event.stopPropagation();
          }}
          onContextMenu={(event) => {
            event.preventDefault();
          }}
        >
          <li
            onClick={() => {
              handleRefresh(selectedView);
              setMenuVisible(false);
            }}
          >
            <span className="tags-view-contextmenu-item">
              <ReloadOutlined />
              <span>刷新页面</span>
            </span>
          </li>
          {!selectedView.affix ? (
            <li
              onClick={() => {
                handleCloseCurrent(selectedView);
                setMenuVisible(false);
              }}
            >
              <span className="tags-view-contextmenu-item">
                <CloseOutlined />
                <span>关闭当前</span>
              </span>
            </li>
          ) : null}
          <li
            onClick={() => {
              handleCloseOthers(selectedView);
              setMenuVisible(false);
            }}
          >
            <span className="tags-view-contextmenu-item">
              <CloseCircleOutlined />
              <span>关闭其他</span>
            </span>
          </li>
          {selectedIndex > 0 ? (
            <li
              onClick={() => {
                handleCloseLeft(selectedView);
                setMenuVisible(false);
              }}
            >
              <span className="tags-view-contextmenu-item">
                <LeftOutlined />
                <span>关闭左侧</span>
              </span>
            </li>
          ) : null}
          {selectedIndex >= 0 && selectedIndex < visitedViews.length - 1 ? (
            <li
              onClick={() => {
                handleCloseRight(selectedView);
                setMenuVisible(false);
              }}
            >
              <span className="tags-view-contextmenu-item">
                <RightOutlined />
                <span>关闭右侧</span>
              </span>
            </li>
          ) : null}
          <li
            onClick={() => {
              handleCloseAll();
              setMenuVisible(false);
            }}
          >
            <span className="tags-view-contextmenu-item">
              <CloseCircleOutlined />
              <span>全部关闭</span>
            </span>
          </li>
        </ul>
      ) : null}
    </div>
  );
}
