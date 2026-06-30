import type { ModalProps } from 'antd';
import { Modal } from 'antd';
import type { CSSProperties } from 'react';

const scrollableBodyStyle: CSSProperties = {
  maxHeight: 'calc(90vh - 120px)',
  overflowY: 'auto',
  overflowX: 'hidden',
  paddingRight: 8,
};

const mergeScrollableBodyStyle = (
  styles: ModalProps['styles'],
): ModalProps['styles'] => {
  if (typeof styles === 'function') {
    return (info) => {
      const resolvedStyles = styles(info);
      return {
        ...resolvedStyles,
        body: {
          ...scrollableBodyStyle,
          ...resolvedStyles?.body,
        },
      };
    };
  }

  return {
    ...styles,
    body: {
      ...scrollableBodyStyle,
      ...styles?.body,
    },
  };
};

export default function CrudModal({
  centered = true,
  styles,
  ...props
}: ModalProps) {
  return (
    <Modal
      centered={centered}
      styles={mergeScrollableBodyStyle(styles)}
      {...props}
    />
  );
}
