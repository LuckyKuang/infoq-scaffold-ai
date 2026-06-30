import type { ModalProps } from 'antd';
import { Modal } from 'antd';
import type { CSSProperties } from 'react';

const scrollableBodyStyle: CSSProperties = {
  maxHeight: 'calc(90vh - 120px)',
  overflowY: 'auto',
  overflowX: 'hidden',
  paddingRight: 8
};

export default function CrudModal({ centered = true, styles, ...props }: ModalProps) {
  return (
    <Modal
      centered={centered}
      styles={{
        ...styles,
        body: {
          ...scrollableBodyStyle,
          ...styles?.body
        }
      }}
      {...props}
    />
  );
}
