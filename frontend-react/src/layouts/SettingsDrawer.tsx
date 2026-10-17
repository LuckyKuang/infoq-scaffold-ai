import type { CSSProperties } from 'react';
import { CheckOutlined } from '@ant-design/icons';
import { Button, ColorPicker, Divider, Drawer, Switch, Typography, message, theme as antdTheme } from 'antd';
import { useTranslation } from 'react-i18next';
import darkPreview from '@/assets/images/dark.svg';
import lightPreview from '@/assets/images/light.svg';
import { SideThemeEnum } from '@/enums/SideThemeEnum';
import { useSettingsStore } from '@/store/modules/settings';

type SettingsDrawerProps = {
  open: boolean;
  onClose: () => void;
};

const presetColors = ['#409EFF', '#ff4500', '#ff8c00', '#ffd700', '#90ee90', '#00ced1', '#1e90ff', '#c71585'];

export default function SettingsDrawer({ open, onClose }: SettingsDrawerProps) {
  const { t } = useTranslation();
  const themeColor = useSettingsStore((state) => state.theme);
  const sideTheme = useSettingsStore((state) => state.sideTheme);
  const topNav = useSettingsStore((state) => state.topNav);
  const tagsView = useSettingsStore((state) => state.tagsView);
  const tagsIcon = useSettingsStore((state) => state.tagsIcon);
  const fixedHeader = useSettingsStore((state) => state.fixedHeader);
  const sidebarLogo = useSettingsStore((state) => state.sidebarLogo);
  const dynamicTitle = useSettingsStore((state) => state.dynamicTitle);
  const dark = useSettingsStore((state) => state.dark);
  const setTheme = useSettingsStore((state) => state.setTheme);
  const setSideTheme = useSettingsStore((state) => state.setSideTheme);
  const toggleTopNav = useSettingsStore((state) => state.toggleTopNav);
  const toggleTagsView = useSettingsStore((state) => state.toggleTagsView);
  const toggleTagsIcon = useSettingsStore((state) => state.toggleTagsIcon);
  const toggleFixedHeader = useSettingsStore((state) => state.toggleFixedHeader);
  const toggleSidebarLogo = useSettingsStore((state) => state.toggleSidebarLogo);
  const toggleDynamicTitle = useSettingsStore((state) => state.toggleDynamicTitle);
  const toggleDark = useSettingsStore((state) => state.toggleDark);
  const resetSettings = useSettingsStore((state) => state.resetSettings);
  const {
    token: { colorPrimary, colorBorderSecondary }
  } = antdTheme.useToken();

  const rowStyle = {
    padding: '12px 0',
    fontSize: 14,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between'
  } satisfies CSSProperties;

  const previewOptions = [
    {
      value: SideThemeEnum.DARK,
      label: t('settings.themeDark'),
      image: darkPreview
    },
    {
      value: SideThemeEnum.LIGHT,
      label: t('settings.themeLight'),
      image: lightPreview
    }
  ];

  return (
    <Drawer title={null} placement="right" size={300} closable={false} open={open} onClose={onClose}>
      <div style={{ display: 'flex', minHeight: '100%', flexDirection: 'column' }}>
        <div>
          <Typography.Title level={5} style={{ marginBottom: 12 }}>
            {t('settings.appearanceTitle')}
          </Typography.Title>

          <div style={{ display: 'flex', gap: 16, marginTop: 10, marginBottom: 20 }}>
            {previewOptions.map((option) => {
              const selected = sideTheme === option.value;
              return (
                <div
                  key={option.value}
                  onClick={() => setSideTheme(option.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      setSideTheme(option.value);
                    }
                  }}
                  role="button"
                  tabIndex={0}
                  style={{
                    position: 'relative',
                    cursor: 'pointer',
                    borderRadius: 4,
                    border: `1px solid ${selected ? colorPrimary : colorBorderSecondary}`,
                    padding: 4
                  }}
                >
                  <img src={option.image} alt={option.label} style={{ width: 48, height: 48, display: 'block' }} />
                  {selected ? (
                    <div
                      style={{
                        position: 'absolute',
                        inset: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: colorPrimary,
                        fontSize: 18,
                        fontWeight: 700
                      }}
                    >
                      <CheckOutlined />
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>

          <div style={rowStyle}>
            <span>{t('settings.themeColor')}</span>
            <ColorPicker
              value={themeColor}
              disabledAlpha
              showText={false}
              format="hex"
              presets={[
                {
                  label: t('settings.themeColor'),
                  colors: presetColors
                }
              ]}
              onChange={(value) => setTheme(value.toHexString().toUpperCase())}
            />
          </div>

          <div style={rowStyle}>
            <span>{t('settings.darkMode')}</span>
            <Switch checked={dark} onChange={toggleDark} />
          </div>

          <Divider style={{ margin: '16px 0' }} />

          <Typography.Title level={5} style={{ marginBottom: 12 }}>
            {t('settings.layoutTitle')}
          </Typography.Title>

          <div style={rowStyle}>
            <span>{t('settings.topNav')}</span>
            <Switch checked={topNav} onChange={toggleTopNav} />
          </div>
          <div style={rowStyle}>
            <span>{t('settings.tagsView')}</span>
            <Switch checked={tagsView} onChange={toggleTagsView} />
          </div>
          <div style={rowStyle}>
            <span>{t('settings.tagsIcon')}</span>
            <Switch checked={tagsIcon} disabled={!tagsView} onChange={toggleTagsIcon} />
          </div>
          <div style={rowStyle}>
            <span>{t('settings.fixedHeader')}</span>
            <Switch checked={fixedHeader} onChange={toggleFixedHeader} />
          </div>
          <div style={rowStyle}>
            <span>{t('settings.sidebarLogo')}</span>
            <Switch checked={sidebarLogo} onChange={toggleSidebarLogo} />
          </div>
          <div style={rowStyle}>
            <span>{t('settings.dynamicTitle')}</span>
            <Switch checked={dynamicTitle} onChange={toggleDynamicTitle} />
          </div>
        </div>

        <Divider style={{ margin: '16px 0' }} />

        <div style={{ display: 'flex', gap: 12 }}>
          <Button
            type="primary"
            onClick={() => {
              message.success(t('settings.saved'));
            }}
          >
            {t('settings.save')}
          </Button>
          <Button
            onClick={() => {
              resetSettings();
              message.success(t('settings.resetDone'));
            }}
          >
            {t('settings.reset')}
          </Button>
        </div>
      </div>
    </Drawer>
  );
}
