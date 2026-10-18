<template>
  <div class="image-upload">
    <el-upload
      v-model:file-list="fileList"
      name="file"
      multiple
      list-type="picture-card"
      :action="uploadAction"
      :headers="uploadHeaders"
      :accept="accept"
      :limit="limit"
      :disabled="disabled"
      :before-upload="handleBeforeUpload"
      :before-remove="handleBeforeRemove"
      :on-success="handleUploadSuccess"
      :on-error="handleUploadError"
      :on-remove="handleRemove"
      :on-exceed="handleExceed"
    >
      <div v-if="!disabled && fileList.length < limit" class="image-upload-trigger" aria-label="选择图片">
        <span class="image-upload-plus">+</span>
        <span>选择图片</span>
      </div>
    </el-upload>
    <div v-if="showTip && !disabled" class="image-upload-tip">
      请上传大小不超过 <em>{{ fileSize }}MB</em>，格式为 <em>{{ normalizedFileTypes.join('/') }}</em> 的图片
    </div>
  </div>
</template>

<script setup name="ImageUpload" lang="ts">
import { delOss, listByIds } from '@/api/system/oss';
import modal from '@/plugins/modal';
import { globalHeaders } from '@/utils/request';
import type { OssVO } from '@/api/system/oss/types';
import type { UploadFile, UploadFiles, UploadProps, UploadRawFile, UploadUserFile } from 'element-plus/es/components/upload';

interface UploadResponse {
  code?: number;
  data?: Partial<Pick<OssVO, 'ossId' | 'fileName' | 'originalName' | 'url'>>;
  msg?: string;
}

type OssUploadUserFile = UploadUserFile & {
  ossId?: string | number;
};

type OssUploadFile = UploadFile & {
  ossId?: string | number;
};

const props = withDefaults(
  defineProps<{
    modelValue?: string;
    limit?: number;
    fileSize?: number;
    fileType?: string[];
    showTip?: boolean;
    disabled?: boolean;
  }>(),
  {
    modelValue: '',
    limit: 5,
    fileSize: 5,
    fileType: () => ['png', 'jpg', 'jpeg'],
    showTip: true,
    disabled: false
  }
);

const emit = defineEmits<{
  (event: 'update:modelValue', value: string): void;
}>();

const fileList = ref<OssUploadUserFile[]>([]);
const uploadAction = computed(() => `${import.meta.env.VITE_APP_BASE_API}/resource/oss/upload`);
const uploadHeaders = computed(() => globalHeaders());
const normalizedFileTypes = computed(() => props.fileType.map((item) => item.replace(/^\./, '').toLowerCase()).filter(Boolean));
const accept = computed(() => normalizedFileTypes.value.map((item) => `.${item}`).join(','));

let hydrateVersion = 0;

const normalizeModelValue = (value?: string) =>
  (value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .join(',');

const toValueString = (list: OssUploadUserFile[]) =>
  list
    .filter((item) => item.ossId !== undefined && item.ossId !== null && item.ossId !== '')
    .map((item) => item.ossId)
    .join(',');

const toUploadUid = (value: string | number | undefined, fallback: number) => {
  const uid = Number(value);
  return Number.isFinite(uid) ? uid : fallback;
};

const toUploadFile = (item: OssVO, index: number): OssUploadUserFile => ({
  uid: toUploadUid(item.ossId, Date.now() + index),
  name: item.originalName || item.fileName || String(item.ossId),
  status: 'success',
  url: item.url,
  ossId: item.ossId
});

const toMimeTypes = (types: string[]) =>
  types.map((type) => {
    if (type === 'jpg') {
      return 'image/jpeg';
    }
    if (type === 'svg') {
      return 'image/svg+xml';
    }
    return `image/${type}`;
  });

const syncModelValue = () => {
  emit('update:modelValue', toValueString(fileList.value));
};

const findCurrentFile = (uploadFile: UploadFile) =>
  fileList.value.find((item) => item.uid === uploadFile.uid || (item.ossId !== undefined && String(item.ossId) === String(uploadFile.uid)));

const removeFile = (uid: number) => {
  fileList.value = fileList.value.filter((item) => item.uid !== uid);
  syncModelValue();
};

const assertUploadResponse = (response: unknown): Required<Pick<UploadResponse, 'data'>> & UploadResponse => {
  const payload = response as UploadResponse;
  if (payload?.code !== 200 || !payload.data?.ossId) {
    throw new Error(payload?.msg || '上传图片响应格式错误');
  }
  return payload as Required<Pick<UploadResponse, 'data'>> & UploadResponse;
};

watch(
  () => props.modelValue,
  async (value) => {
    const nextValue = normalizeModelValue(value);
    if (!nextValue) {
      hydrateVersion++;
      fileList.value = [];
      return;
    }

    if (nextValue === toValueString(fileList.value)) {
      return;
    }

    const currentVersion = ++hydrateVersion;
    try {
      const response = await listByIds(nextValue);
      if (!Array.isArray(response.data)) {
        throw new Error('图片列表响应格式错误');
      }
      if (currentVersion !== hydrateVersion) {
        return;
      }
      fileList.value = response.data.map(toUploadFile);
    } catch {
      if (currentVersion === hydrateVersion) {
        fileList.value = [];
      }
      modal.msgError('加载已上传图片失败，请稍后重试');
    }
  },
  { immediate: true }
);

const handleBeforeUpload: UploadProps['beforeUpload'] = (file: UploadRawFile) => {
  const fileName = file.name || '';
  const fileExt = fileName.includes('.') ? fileName.slice(fileName.lastIndexOf('.') + 1).toLowerCase() : '';
  const mimeTypes = toMimeTypes(normalizedFileTypes.value);
  const isAllowedImage = normalizedFileTypes.value.includes(fileExt) || mimeTypes.includes(file.type.toLowerCase());
  if (!isAllowedImage) {
    modal.msgError(`文件格式不正确，请上传 ${normalizedFileTypes.value.join('/')} 图片格式文件`);
    return false;
  }
  if (fileName.includes(',')) {
    modal.msgError('文件名不能包含英文逗号');
    return false;
  }
  if (props.fileSize > 0 && file.size / 1024 / 1024 > props.fileSize) {
    modal.msgError(`上传图片大小不能超过 ${props.fileSize}MB`);
    return false;
  }
  modal.loading('正在上传图片，请稍候...');
  return true;
};

const handleUploadSuccess: UploadProps['onSuccess'] = (response: unknown, uploadFile: UploadFile) => {
  try {
    const payload = assertUploadResponse(response);
    const uploadedFile: OssUploadUserFile = {
      ...uploadFile,
      name: payload.data.originalName || payload.data.fileName || uploadFile.name,
      status: 'success',
      url: payload.data.url || uploadFile.url,
      ossId: payload.data.ossId
    };
    const fileIndex = fileList.value.findIndex((item) => item.uid === uploadFile.uid);
    if (fileIndex === -1) {
      fileList.value.push(uploadedFile);
    } else {
      fileList.value.splice(fileIndex, 1, uploadedFile);
    }
    modal.closeLoading();
    syncModelValue();
  } catch (error) {
    modal.closeLoading();
    modal.msgError(error instanceof Error ? error.message : '上传图片失败');
    removeFile(uploadFile.uid);
  }
};

const handleUploadError: UploadProps['onError'] = (_error: Error, uploadFile: UploadFile) => {
  modal.closeLoading();
  modal.msgError('上传图片失败');
  removeFile(uploadFile.uid);
};

const handleBeforeRemove: UploadProps['beforeRemove'] = async (uploadFile: UploadFile) => {
  const current = findCurrentFile(uploadFile) as OssUploadFile | undefined;
  if (!current?.ossId) {
    return true;
  }
  try {
    await delOss(current.ossId);
    return true;
  } catch {
    modal.msgError('删除已上传图片失败，请稍后重试');
    return false;
  }
};

const handleRemove: UploadProps['onRemove'] = (_uploadFile: UploadFile, uploadFiles: UploadFiles) => {
  fileList.value = uploadFiles as OssUploadUserFile[];
  syncModelValue();
};

const handleExceed: UploadProps['onExceed'] = () => {
  modal.msgError(`最多上传 ${props.limit} 张图片`);
};
</script>

<style scoped lang="scss">
.image-upload-trigger {
  align-items: center;
  color: var(--el-text-color-secondary);
  display: flex;
  flex-direction: column;
  font-size: 13px;
  gap: 6px;
  justify-content: center;
}

.image-upload-plus {
  font-size: 28px;
  line-height: 1;
}

.image-upload-tip {
  color: var(--el-text-color-secondary);
  font-size: 12px;
  line-height: 1.5;
  margin-top: 6px;

  em {
    color: var(--el-color-danger);
    font-style: normal;
    font-weight: 600;
  }
}
</style>
