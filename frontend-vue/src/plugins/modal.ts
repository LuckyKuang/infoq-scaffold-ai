import type { LoadingInstance } from 'element-plus/es/components/loading/src/loading';
import type { MessageBoxData } from 'element-plus/es/components/message-box/src/message-box.type';

type MessageContent = Parameters<typeof ElMessage.info>[0];
type AlertContent = Parameters<typeof ElMessageBox.alert>[0];
type ConfirmContent = Parameters<typeof ElMessageBox.confirm>[0];
type PromptContent = Parameters<typeof ElMessageBox.prompt>[0];
type NotificationContent = Parameters<typeof ElNotification.info>[0];

let loadingInstance: LoadingInstance;
export default {
  // 消息提示
  msg(content: MessageContent) {
    ElMessage.info(content);
  },
  // 错误消息
  msgError(content: MessageContent) {
    ElMessage.error(content);
  },
  // 成功消息
  msgSuccess(content: MessageContent) {
    ElMessage.success(content);
  },
  // 警告消息
  msgWarning(content: MessageContent) {
    ElMessage.warning(content);
  },
  // 弹出提示
  alert(content: AlertContent) {
    ElMessageBox.alert(content, '系统提示');
  },
  // 错误提示
  alertError(content: AlertContent) {
    ElMessageBox.alert(content, '系统提示', { type: 'error' });
  },
  // 成功提示
  alertSuccess(content: AlertContent) {
    ElMessageBox.alert(content, '系统提示', { type: 'success' });
  },
  // 警告提示
  alertWarning(content: AlertContent) {
    ElMessageBox.alert(content, '系统提示', { type: 'warning' });
  },
  // 通知提示
  notify(content: NotificationContent) {
    ElNotification.info(content);
  },
  // 错误通知
  notifyError(content: NotificationContent) {
    ElNotification.error(content);
  },
  // 成功通知
  notifySuccess(content: NotificationContent) {
    ElNotification.success(content);
  },
  // 警告通知
  notifyWarning(content: NotificationContent) {
    ElNotification.warning(content);
  },
  // 确认窗体
  confirm(content: ConfirmContent): Promise<MessageBoxData> {
    return ElMessageBox.confirm(content, '系统提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    });
  },
  // 提交内容
  prompt(content: PromptContent) {
    return ElMessageBox.prompt(content, '系统提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    });
  },
  // 打开遮罩层
  loading(content: string) {
    loadingInstance = ElLoading.service({
      lock: true,
      text: content,
      background: 'rgba(0, 0, 0, 0.7)'
    });
  },
  // 关闭遮罩层
  closeLoading() {
    loadingInstance.close();
  }
};
