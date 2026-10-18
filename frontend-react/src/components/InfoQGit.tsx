import { Button, Tooltip } from 'antd';
import { useTranslation } from 'react-i18next';
import SvgIcon from '@/components/SvgIcon';

const repositoryUrl = 'https://github.com/luckykuang/infoq-scaffold-ai';

export default function InfoQGit() {
  const { t } = useTranslation();

  return (
    <Tooltip title={t('navbar.github')}>
      <Button
        type="text"
        icon={<SvgIcon iconClass="github" size={18} title={t('navbar.github')} />}
        onClick={() => window.open(repositoryUrl, '_blank', 'noopener,noreferrer')}
      />
    </Tooltip>
  );
}
