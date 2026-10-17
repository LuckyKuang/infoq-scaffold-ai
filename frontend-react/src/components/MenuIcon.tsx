import SvgIcon from '@/components/SvgIcon';

type MenuIconProps = {
  iconClass?: string;
};

export default function MenuIcon({ iconClass }: MenuIconProps) {
  return <SvgIcon iconClass={iconClass} size={16} style={{ marginRight: 10 }} />;
}
