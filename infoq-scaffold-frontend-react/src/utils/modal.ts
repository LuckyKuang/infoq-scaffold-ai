import { message, Modal, notification } from 'antd';
import type { ArgsProps } from 'antd/es/notification/interface';

const LOADING_MESSAGE_KEY = 'global-loading';
let loadingCloser: (() => void) | null = null;

type MessageApi = {
  info: typeof message.info;
  error: typeof message.error;
  success: typeof message.success;
  warning: typeof message.warning;
  loading: typeof message.loading;
  open: typeof message.open;
  destroy: typeof message.destroy;
};

type ModalApi = Pick<typeof Modal, 'info' | 'error' | 'success' | 'warning' | 'confirm'>;
type NotificationArgs = Omit<ArgsProps, 'message'>;

type NotificationApi = {
  info: typeof notification.info;
  error: typeof notification.error;
  success: typeof notification.success;
  warning: typeof notification.warning;
};

let runtimeMessage: MessageApi | null = null;
let runtimeModal: ModalApi | null = null;
let runtimeNotification: NotificationApi | null = null;

const asText = (content: unknown) => {
  if (typeof content === 'string') {
    return content;
  }
  if (content instanceof Error) {
    return content.message;
  }
  return String(content ?? '');
};

export const registerModalRuntime = (runtime: { message: MessageApi; modal: ModalApi; notification: NotificationApi }) => {
  runtimeMessage = runtime.message;
  runtimeModal = runtime.modal;
  runtimeNotification = runtime.notification;
};

const getMessageApi = () => runtimeMessage ?? message;
const getModalApi = () => runtimeModal ?? Modal;
const getNotificationApi = () => runtimeNotification ?? notification;

const modal = {
  msg: (content: unknown) => getMessageApi().info(asText(content)),
  msgError: (content: unknown) => getMessageApi().error(asText(content)),
  msgSuccess: (content: unknown) => getMessageApi().success(asText(content)),
  msgWarning: (content: unknown) => getMessageApi().warning(asText(content)),
  alert: (content: unknown) =>
    getModalApi().info({
      title: '系统提示',
      content: asText(content)
    }),
  alertError: (content: unknown) =>
    getModalApi().error({
      title: '系统提示',
      content: asText(content)
    }),
  alertSuccess: (content: unknown) =>
    getModalApi().success({
      title: '系统提示',
      content: asText(content)
    }),
  alertWarning: (content: unknown) =>
    getModalApi().warning({
      title: '系统提示',
      content: asText(content)
    }),
  notify: (content: NotificationArgs | string) => getNotificationApi().info(typeof content === 'string' ? { title: content } : content),
  notifyError: (content: NotificationArgs | string) => getNotificationApi().error(typeof content === 'string' ? { title: content } : content),
  notifySuccess: (content: NotificationArgs | string) => getNotificationApi().success(typeof content === 'string' ? { title: content } : content),
  notifyWarning: (content: NotificationArgs | string) => getNotificationApi().warning(typeof content === 'string' ? { title: content } : content),
  confirm: (content: unknown) =>
    new Promise<boolean>((resolve) => {
      getModalApi().confirm({
        title: '系统提示',
        content: asText(content),
        okText: '确定',
        cancelText: '取消',
        onOk: () => resolve(true),
        onCancel: () => resolve(false)
      });
    }),
  loading: (content = '处理中...') => {
    if (loadingCloser) {
      loadingCloser();
      loadingCloser = null;
    }
    loadingCloser = getMessageApi().open({
      key: LOADING_MESSAGE_KEY,
      type: 'loading',
      content,
      duration: 0
    });
  },
  closeLoading: () => {
    if (loadingCloser) {
      loadingCloser();
      loadingCloser = null;
    }
    getMessageApi().destroy(LOADING_MESSAGE_KEY);
  }
};

export default modal;
