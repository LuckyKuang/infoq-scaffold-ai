import { Dropdown, message, Tooltip } from 'antd';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { AppSize } from '@/store/modules/app';
import { useAppStore } from '@/store/modules/app';
import SvgIcon from '@/components/SvgIcon';

const sizeOptions: Array<{ label: string; value: AppSize }> = [
  { label: '较大', value: 'large' },
  { label: '默认', value: 'middle' },
  { label: '稍小', value: 'small' }
];

export default function SizeSelect() {
  const { t } = useTranslation();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const size = useAppStore((state) => state.size);
  const setSize = useAppStore((state) => state.setSize);
  const items = sizeOptions.map((item) => ({
    key: item.value,
    label: item.label,
    disabled: size === item.value
  }));

  return (
    <Dropdown
      menu={{
        items,
        onClick: ({ key }) => {
          setSize(key as AppSize);
          message.success(t('navbar.layoutSizeUpdated'));
        }
      }}
      trigger={['click']}
      open={dropdownOpen}
      onOpenChange={setDropdownOpen}
    >
      <span style={{ display: 'inline-flex' }}>
        <Tooltip title={t('navbar.layoutSize')} open={dropdownOpen ? false : undefined}>
          <div style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', padding: '0 4px' }}>
            <SvgIcon iconClass="size" size={18} title={t('navbar.layoutSize')} />
          </div>
        </Tooltip>
      </span>
    </Dropdown>
  );
}
