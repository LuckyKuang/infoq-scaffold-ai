import {Dropdown, Tooltip} from 'antd';
import {useState} from 'react';
import {useTranslation} from 'react-i18next';
import SvgIcon from '@/components/SvgIcon';
import {useAppStore} from '@/store/modules/app';
import modal from '@/utils/modal';

const options = [
  { label: '中文', value: 'zh_CN' },
  { label: 'English', value: 'en_US' },
];

export default function LangSelect() {
  const { i18n, t } = useTranslation();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const language = useAppStore((state) => state.language);
  const changeLanguage = useAppStore((state) => state.changeLanguage);
  const currentLanguage = language || 'zh_CN';
  const items = options.map((item) => ({
    key: item.value,
    label: item.label,
    disabled: currentLanguage === item.value,
  }));

  return (
    <Dropdown
      menu={{
        items,
        onClick: ({ key }) => {
          const nextLanguage = String(key);
          changeLanguage(nextLanguage);
          i18n.changeLanguage(nextLanguage);
          modal.msgSuccess(
            nextLanguage === 'en_US'
              ? 'Switch Language Successful!'
              : '切换语言成功！',
          );
        },
      }}
      trigger={['click']}
      open={dropdownOpen}
      onOpenChange={setDropdownOpen}
    >
      <span style={{ display: 'inline-flex' }}>
        <Tooltip
          title={t('navbar.language')}
          open={dropdownOpen ? false : undefined}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              cursor: 'pointer',
              padding: '0 4px',
            }}
          >
            <SvgIcon
              iconClass="language"
              size={18}
              title={t('navbar.language')}
            />
          </div>
        </Tooltip>
      </span>
    </Dropdown>
  );
}
