# infoq-plugin-web

## 1. 模块职责

提供 Web 基础设施，包括验证码、XSS 过滤、可重复读取请求包装、国际化、静态资源映射和全局异常处理。

## 2. 关键入口

- `CaptchaConfig`
- `FilterConfig`
- `I18nConfig`
- `ResourcesConfig`

## 3. 核心类 / 文件

- `BaseController`
- `GlobalExceptionHandler`
- `RepeatableFilter` / `RepeatedlyRequestWrapper`
- `XssFilter` / `XssHttpServletRequestWrapper`
- `CaptchaProperties`、`XssProperties`
- 自动装配入口：[`AutoConfiguration.imports`](./src/main/resources/META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports)

## 4. 上游依赖

- 所有 HTTP 控制器都会间接运行在这个模块提供的 Web 基础设施之上。
- `CaptchaController`、全局异常输出、国际化消息解析等都直接受这里影响。

## 5. 下游依赖

- 编译期依赖 `infoq-plugin-jackson`

## 6. 关键配置

- `captcha.*`
- `xss.*`
- `xss.enabled`

## 7. 关键数据流

1. 启动时注册 Web 相关配置和过滤器。
2. 请求进入后先经过可重复读取、XSS 等过滤链。
3. 业务异常最终由 `GlobalExceptionHandler` 统一整理输出。

## 8. 扩展点

- `BaseController`
- `GlobalExceptionHandler`
- 过滤器和属性配置

## 9. 日志 / 监控切入点

- 验证码异常、XSS 过滤副作用、全局异常输出格式问题都要从这里切入。
- 该模块是多数 HTTP 基础故障的首层排查入口。

## 10. 已知边界

- 不负责权限校验，权限在 `security`。
- 不负责业务 Controller 实现。

