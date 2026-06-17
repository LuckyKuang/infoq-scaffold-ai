import {
  MinusOutlined,
  PlusOutlined,
  RedoOutlined,
  UndoOutlined,
  UploadOutlined,
  UserOutlined,
} from '@ant-design/icons';
import type { UploadProps } from 'antd';
import { Avatar, Button, Col, Modal, Row, Space, Upload } from 'antd';
import { useEffect, useState } from 'react';
import Cropper, { type Area } from 'react-easy-crop';
import 'react-easy-crop/react-easy-crop.css';
import { uploadAvatar } from '@/api/system/user';
import { assertAvatarUploadData } from '@/api/system/user/guards';
import { useUserStore } from '@/store/modules/user';
import modal from '@/utils/modal';
import '@/pages/system/user/profile/user-avatar.css';

type UserAvatarProps = {
  avatar?: string;
  onUploaded?: (value: string) => void;
};

const createImage = (url: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.addEventListener('load', () => resolve(image));
    image.addEventListener('error', (error) => reject(error));
    image.setAttribute('crossOrigin', 'anonymous');
    image.src = url;
  });

const getRadianAngle = (degreeValue: number) => (degreeValue * Math.PI) / 180;

const rotateSize = (width: number, height: number, rotation: number) => {
  const rotRad = getRadianAngle(rotation);
  return {
    width:
      Math.abs(Math.cos(rotRad) * width) + Math.abs(Math.sin(rotRad) * height),
    height:
      Math.abs(Math.sin(rotRad) * width) + Math.abs(Math.cos(rotRad) * height),
  };
};

// Draw the selected crop area into a canvas so the backend receives the same avatar content as the Vue flow.
const getCroppedBlob = async (
  imageSrc: string,
  pixelCrop: Area,
  rotation = 0,
) => {
  const image = await createImage(imageSrc);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('Canvas context is not available');
  }

  const rotRad = getRadianAngle(rotation);
  const { width: rotatedWidth, height: rotatedHeight } = rotateSize(
    image.width,
    image.height,
    rotation,
  );

  canvas.width = rotatedWidth;
  canvas.height = rotatedHeight;

  ctx.translate(rotatedWidth / 2, rotatedHeight / 2);
  ctx.rotate(rotRad);
  ctx.translate(-image.width / 2, -image.height / 2);
  ctx.drawImage(image, 0, 0);

  const croppedImage = ctx.getImageData(
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
  );
  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;
  ctx.putImageData(croppedImage, 0, 0);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('Canvas is empty'));
        return;
      }
      resolve(blob);
    }, 'image/png');
  });
};

const fileToDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(file);
  });

export default function UserAvatar({ avatar, onUploaded }: UserAvatarProps) {
  const storeAvatar = useUserStore((state) => state.avatar);
  const setAvatar = useUserStore((state) => state.setAvatar);
  const currentAvatar = avatar || storeAvatar || '';

  const [open, setOpen] = useState(false);
  const [imageSrc, setImageSrc] = useState(currentAvatar);
  const [fileName, setFileName] = useState('avatar.png');
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area>();
  const [previewUrl, setPreviewUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      setImageSrc(currentAvatar);
    }
  }, [currentAvatar, open]);

  useEffect(() => {
    if (!open || !imageSrc || !croppedAreaPixels) {
      return;
    }

    let active = true;
    let nextPreviewUrl = '';

    const syncPreview = async () => {
      try {
        const blob = await getCroppedBlob(
          imageSrc,
          croppedAreaPixels,
          rotation,
        );
        nextPreviewUrl = URL.createObjectURL(blob);
        if (!active) {
          URL.revokeObjectURL(nextPreviewUrl);
          return;
        }
        setPreviewUrl((current) => {
          if (current) {
            URL.revokeObjectURL(current);
          }
          return nextPreviewUrl;
        });
      } catch {
        if (active) {
          setPreviewUrl('');
        }
      }
    };

    syncPreview();

    return () => {
      active = false;
      if (nextPreviewUrl) {
        URL.revokeObjectURL(nextPreviewUrl);
      }
    };
  }, [croppedAreaPixels, imageSrc, open, rotation]);

  useEffect(
    () => () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    },
    [previewUrl],
  );

  const resetEditor = (source = currentAvatar) => {
    setImageSrc(source);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setRotation(0);
    setCroppedAreaPixels(undefined);
    setPreviewUrl('');
  };

  const uploadProps: UploadProps = {
    showUploadList: false,
    beforeUpload: async (file) => {
      if (!file.type.startsWith('image/')) {
        modal.msgError('文件格式错误，请上传图片类型,如：JPG，PNG后缀的文件。');
        return Upload.LIST_IGNORE;
      }
      const dataUrl = await fileToDataUrl(file as File);
      setFileName(file.name);
      resetEditor(dataUrl);
      setOpen(true);
      return false;
    },
  };

  const handleOpen = () => {
    resetEditor(currentAvatar);
    setFileName('avatar.png');
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    resetEditor(currentAvatar);
  };

  const handleSubmit = async () => {
    if (!imageSrc || !croppedAreaPixels) {
      return;
    }

    setSubmitting(true);
    try {
      const blob = await getCroppedBlob(imageSrc, croppedAreaPixels, rotation);
      const formData = new FormData();
      formData.append('avatarfile', blob, fileName || 'avatar.png');
      const response = await uploadAvatar(formData);
      const { imgUrl } = assertAvatarUploadData(response.data);

      setAvatar(imgUrl);
      onUploaded?.(imgUrl);
      modal.msgSuccess('修改成功');
      setOpen(false);
    } catch (error) {
      modal.msgError(error instanceof Error ? error.message : '头像上传失败');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <button className="user-avatar-head" type="button" onClick={handleOpen}>
        <Avatar
          size={120}
          src={currentAvatar || undefined}
          icon={<UserOutlined />}
        />
      </button>

      <Upload {...uploadProps}>
        <Button style={{ marginTop: 12 }}>上传头像</Button>
      </Upload>

      <Modal
        open={open}
        title="修改头像"
        width={800}
        destroyOnHidden
        onCancel={handleClose}
        footer={null}
      >
        <Row gutter={[24, 24]}>
          <Col xs={24} md={12}>
            <div className="user-avatar-cropper">
              {imageSrc ? (
                <Cropper
                  image={imageSrc}
                  crop={crop}
                  zoom={zoom}
                  rotation={rotation}
                  aspect={1}
                  objectFit="contain"
                  showGrid
                  onCropChange={setCrop}
                  onZoomChange={setZoom}
                  onRotationChange={setRotation}
                  onCropComplete={(_, croppedPixels) =>
                    setCroppedAreaPixels(croppedPixels)
                  }
                />
              ) : null}
            </div>
          </Col>
          <Col xs={24} md={12}>
            <div className="user-avatar-preview">
              {previewUrl || imageSrc ? (
                <img src={previewUrl || imageSrc} alt="avatar preview" />
              ) : null}
            </div>
          </Col>
        </Row>

        <Space
          wrap
          size={12}
          style={{
            width: '100%',
            justifyContent: 'space-between',
            marginTop: 24,
          }}
        >
          <Space wrap size={12}>
            <Upload {...uploadProps}>
              <Button icon={<UploadOutlined />}>选择</Button>
            </Upload>
            <Button
              icon={<PlusOutlined />}
              onClick={() => setZoom((value) => Math.min(value + 0.2, 3))}
            />
            <Button
              icon={<MinusOutlined />}
              onClick={() => setZoom((value) => Math.max(value - 0.2, 1))}
            />
            <Button
              icon={<UndoOutlined />}
              onClick={() => setRotation((value) => value - 90)}
            />
            <Button
              icon={<RedoOutlined />}
              onClick={() => setRotation((value) => value + 90)}
            />
          </Space>
          <Button type="primary" loading={submitting} onClick={handleSubmit}>
            提 交
          </Button>
        </Space>
      </Modal>
    </>
  );
}
