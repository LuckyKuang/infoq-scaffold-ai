import type { CSSProperties } from 'react';

const iconModules = import.meta.glob('../assets/icons/svg/*.svg', {
  eager: true,
  query: '?raw',
  import: 'default'
}) as Record<string, string>;

const iconMap = Object.fromEntries(
  Object.entries(iconModules).map(([filePath, assetUrl]) => {
    const fileName = filePath.split('/').pop() || filePath;
    return [fileName.replace(/\.svg$/, ''), assetUrl];
  })
);

const ICON_ALIASES: Record<string, string> = {
  loginInfo: 'logininfor'
};

type SvgIconProps = {
  iconClass?: string;
  className?: string;
  size?: number | string;
  style?: CSSProperties;
  title?: string;
};

const sanitizeSvg = (svgContent: string) => {
  const svgMatch = svgContent.match(/<svg\b([^>]*)>/i);
  const svgAttrs = svgMatch?.[1] || '';
  const widthMatch = svgAttrs.match(/\swidth=("|')([^"']+)\1/i);
  const heightMatch = svgAttrs.match(/\sheight=("|')([^"']+)\1/i);
  const viewBoxMatch = svgAttrs.match(/\sviewBox=("|')([^"']+)\1/i);
  const width = widthMatch?.[2]?.match(/[\d.]+/)?.[0];
  const height = heightMatch?.[2]?.match(/[\d.]+/)?.[0];
  const fallbackViewBox = !viewBoxMatch && width && height ? `0 0 ${width} ${height}` : null;

  return svgContent
    .replace(/<\?xml[\s\S]*?\?>/gi, '')
    .replace(/<!DOCTYPE[\s\S]*?>/gi, '')
    .replace(/\s(fill|stroke)=("|')(?!none\2|currentColor\2)[^"']*\2/gi, '')
    .replace(/<svg\b([^>]*)>/i, (_, attrs: string) => {
      const sanitizedAttrs = attrs.replace(/\s(width|height|class|style|fill|stroke)=("|')[^"']*\2/gi, '');
      const normalizedViewBox = viewBoxMatch ? '' : fallbackViewBox ? ` viewBox="${fallbackViewBox}"` : '';
      return `<svg${sanitizedAttrs}${normalizedViewBox} width="100%" height="100%" fill="currentColor" stroke="currentColor" aria-hidden="true" focusable="false">`;
    });
};

export default function SvgIcon({ iconClass, className, size = '1em', style, title }: SvgIconProps) {
  if (!iconClass || iconClass === '#') {
    return null;
  }

  const resolvedIconClass = iconMap[iconClass] ? iconClass : ICON_ALIASES[iconClass];
  const svgContent = resolvedIconClass ? iconMap[resolvedIconClass] : undefined;
  if (!svgContent) {
    return null;
  }

  const markup = sanitizeSvg(svgContent);

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
        color: 'inherit',
        verticalAlign: '-0.15em',
        lineHeight: 0,
        flex: '0 0 auto',
        ...style
      }}
      dangerouslySetInnerHTML={{ __html: markup }}
    />
  );
}
