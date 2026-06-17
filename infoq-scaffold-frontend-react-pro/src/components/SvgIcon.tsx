import type { CSSProperties } from 'react';
import iconMap from './svg-icon-assets';

const ICON_ALIASES: Record<string, string> = {
  loginInfo: 'logininfor',
};

type SvgIconProps = {
  iconClass?: string;
  className?: string;
  size?: number | string;
  style?: CSSProperties;
  title?: string;
};

const toMaskImage = (assetUrl: string) => `url(${JSON.stringify(assetUrl)})`;

export default function SvgIcon({
  iconClass,
  className,
  size = '1em',
  style,
  title,
}: SvgIconProps) {
  if (!iconClass || iconClass === '#') {
    return null;
  }

  const resolvedIconClass = iconMap[iconClass]
    ? iconClass
    : ICON_ALIASES[iconClass];
  const svgContent = resolvedIconClass ? iconMap[resolvedIconClass] : undefined;
  if (!svgContent) {
    return null;
  }

  const maskImage = toMaskImage(svgContent);

  return (
    <span
      role="img"
      aria-label={title || iconClass}
      title={title || iconClass}
      className={className}
      style={{
        width: size,
        height: size,
        display: 'inline-block',
        backgroundColor: 'currentColor',
        maskImage,
        maskPosition: 'center',
        maskRepeat: 'no-repeat',
        maskSize: 'contain',
        WebkitMaskImage: maskImage,
        WebkitMaskPosition: 'center',
        WebkitMaskRepeat: 'no-repeat',
        WebkitMaskSize: 'contain',
        verticalAlign: '-0.15em',
        lineHeight: 0,
        flex: '0 0 auto',
        ...style,
      }}
    />
  );
}
