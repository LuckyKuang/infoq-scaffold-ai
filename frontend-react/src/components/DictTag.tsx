import { Tag } from 'antd';

type DictTagProps = {
  options: DictDataOption[];
  value: number | string | Array<number | string>;
  showValue?: boolean;
  separator?: string;
};

const toValues = (value: DictTagProps['value'], separator: string): string[] => {
  if (value === '' || value === null || typeof value === 'undefined') {
    return [];
  }
  if (Array.isArray(value)) {
    return value.map((item) => String(item));
  }
  return String(value).split(separator);
};

const toTagColor = (type?: ElTagType) => {
  switch (type) {
    case 'success':
      return 'success';
    case 'info':
      return 'default';
    case 'warning':
      return 'warning';
    case 'danger':
      return 'error';
    default:
      return 'processing';
  }
};

export default function DictTag({ options, value, showValue = true, separator = ',' }: DictTagProps) {
  const values = toValues(value, separator);
  const matched = options.filter((item) => values.some((val) => String(item.value) === val));
  const unmatched = values.filter((val) => !options.some((item) => String(item.value) === val));

  return (
    <>
      {matched.map((item) => {
        if (!item.elTagType && !item.elTagClass) {
          return (
            <span key={String(item.value)} className={item.elTagClass}>
              {item.label}{' '}
            </span>
          );
        }
        return (
          <Tag key={String(item.value)} color={toTagColor(item.elTagType)} className={item.elTagClass}>
            {item.label}
          </Tag>
        );
      })}
      {showValue && unmatched.length > 0 && unmatched.join(' ')}
    </>
  );
}
