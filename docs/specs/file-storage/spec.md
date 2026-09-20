# 文件存储规范

## 目标

定义当前仓库的 OSS 文件管理、私有对象访问策略，以及用户头像上传行为。

## 要求

### 要求：OSS 资源管理入口
文件管理必须继续通过统一的 OSS 控制器入口暴露。

#### 场景：查询、上传、下载和删除文件

- 当管理员管理文件资源时
- 则必须继续使用 `/resource/oss/list`、`/resource/oss/listByIds/{ossIds}`、`POST /resource/oss/upload`、`GET /resource/oss/download/{ossId}`、`DELETE /resource/oss/{ossIds}`
- 并且上传请求必须继续使用 multipart `file`

### 要求：上传结果与元数据
上传成功后必须返回可供前端立即消费的文件信息。

#### 场景：上传 OSS 文件

- 当上传成功时
- 则返回体必须包含 `url`、原始文件名和 `ossId`
- 并且服务端必须继续持久化 `originalName`、`fileSuffix`、`service` 等元数据

### 要求：私有对象访问策略
私有桶文件在列表和详情读取时必须转换为短时可访问地址。

#### 场景：读取私有 OSS 对象

- 当 OSS 配置的访问策略为 `PRIVATE` 时
- 则系统必须使用预签名 GET URL 返回文件访问地址
- 并且当前有效期必须保持为约 120 秒
- 并且生成访问地址失败时必须显式报错

### 要求：用户头像上传
头像上传必须复用 OSS 能力并校验图片格式。

#### 场景：上传个人头像

- 当当前用户调用 `/system/user/profile/avatar` 时
- 则请求必须继续使用 multipart `avatarfile`
- 并且只允许 `MimeTypeUtils.IMAGE_EXTENSION` 白名单中的图片扩展名
- 并且上传成功后必须把当前用户头像更新为新上传的 `ossId`
- 并且返回体必须包含新的 `imgUrl`
