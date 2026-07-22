# syntax=docker/dockerfile:1.7

# 后端构建阶段：使用 Maven 3.9.12 + Temurin JDK 17 编译打包
FROM maven:3.9.12-eclipse-temurin-17 AS builder

WORKDIR /workspace

COPY pom.xml ./
COPY infoq-core/pom.xml infoq-core/pom.xml
COPY infoq-core/infoq-core-bom/pom.xml infoq-core/infoq-core-bom/pom.xml
COPY infoq-core/infoq-core-common/pom.xml infoq-core/infoq-core-common/pom.xml
COPY infoq-core/infoq-core-data/pom.xml infoq-core/infoq-core-data/pom.xml
COPY infoq-modules/pom.xml infoq-modules/pom.xml
COPY infoq-modules/infoq-system/pom.xml infoq-modules/infoq-system/pom.xml
COPY infoq-plugin/pom.xml infoq-plugin/pom.xml
COPY infoq-plugin/infoq-plugin-doc/pom.xml infoq-plugin/infoq-plugin-doc/pom.xml
COPY infoq-plugin/infoq-plugin-encrypt/pom.xml infoq-plugin/infoq-plugin-encrypt/pom.xml
COPY infoq-plugin/infoq-plugin-elasticsearch/pom.xml infoq-plugin/infoq-plugin-elasticsearch/pom.xml
COPY infoq-plugin/infoq-plugin-excel/pom.xml infoq-plugin/infoq-plugin-excel/pom.xml
COPY infoq-plugin/infoq-plugin-jackson/pom.xml infoq-plugin/infoq-plugin-jackson/pom.xml
COPY infoq-plugin/infoq-plugin-log/pom.xml infoq-plugin/infoq-plugin-log/pom.xml
COPY infoq-plugin/infoq-plugin-mail/pom.xml infoq-plugin/infoq-plugin-mail/pom.xml
COPY infoq-plugin/infoq-plugin-mqtt/pom.xml infoq-plugin/infoq-plugin-mqtt/pom.xml
COPY infoq-plugin/infoq-plugin-mybatis/pom.xml infoq-plugin/infoq-plugin-mybatis/pom.xml
COPY infoq-plugin/infoq-plugin-oauth/pom.xml infoq-plugin/infoq-plugin-oauth/pom.xml
COPY infoq-plugin/infoq-plugin-oss/pom.xml infoq-plugin/infoq-plugin-oss/pom.xml
COPY infoq-plugin/infoq-plugin-push/pom.xml infoq-plugin/infoq-plugin-push/pom.xml
COPY infoq-plugin/infoq-plugin-quartz/pom.xml infoq-plugin/infoq-plugin-quartz/pom.xml
COPY infoq-plugin/infoq-plugin-redis/pom.xml infoq-plugin/infoq-plugin-redis/pom.xml
COPY infoq-plugin/infoq-plugin-security/pom.xml infoq-plugin/infoq-plugin-security/pom.xml
COPY infoq-plugin/infoq-plugin-sensitive/pom.xml infoq-plugin/infoq-plugin-sensitive/pom.xml
COPY infoq-plugin/infoq-plugin-sse/pom.xml infoq-plugin/infoq-plugin-sse/pom.xml
COPY infoq-plugin/infoq-plugin-translation/pom.xml infoq-plugin/infoq-plugin-translation/pom.xml
COPY infoq-plugin/infoq-plugin-web/pom.xml infoq-plugin/infoq-plugin-web/pom.xml
COPY infoq-plugin/infoq-plugin-websocket/pom.xml infoq-plugin/infoq-plugin-websocket/pom.xml
COPY infoq-admin/pom.xml infoq-admin/pom.xml

RUN --mount=type=cache,target=/root/.m2 \
    mvn -B -P prod -pl infoq-admin -am dependency:go-offline -DskipTests

COPY . ./

RUN --mount=type=cache,target=/root/.m2 \
    mvn -B clean package -P prod -pl infoq-admin -am -DskipTests

# 基础运行时镜像，使用 JDK 17
FROM bellsoft/liberica-openjdk-rocky:17.0.16-cds

LABEL maintainer="Pontus"

# 容器默认时区与启动相关环境变量
# 部署时可通过 -e SERVER_PORT=18080 -p 18080:18080 覆盖默认端口
ENV TZ=Asia/Shanghai \
    SERVER_PORT=8080 \
    LANG=C.UTF-8 \
    LC_ALL=C.UTF-8 \
    INFOQ_LOG_PATH=/infoq/server/logs \
    JAVA_OPTS=""

# 预创建应用运行目录，并将容器时区固定为上海时区
RUN mkdir -p /infoq/server/logs \
    /infoq/server/temp \
    /infoq/server/config \
    /infoq/server/ip2region \
    && ln -snf /usr/share/zoneinfo/${TZ} /etc/localtime \
    && echo ${TZ} > /etc/timezone

# 应用工作目录
WORKDIR /infoq/server

# 默认对外暴露应用端口
EXPOSE 8080

# 复制 Docker builder 阶段打包后的应用 Jar 到容器内
COPY --from=builder /workspace/infoq-admin/target/infoq-admin.jar ./app.jar

# 启动应用，运行时可通过 SERVER_PORT 与 JAVA_OPTS 覆盖默认参数
ENTRYPOINT ["sh", "-c", "exec java -Djava.security.egd=file:/dev/./urandom -Dserver.port=${SERVER_PORT} -XX:+HeapDumpOnOutOfMemoryError -XX:+UseZGC ${JAVA_OPTS} -jar app.jar"]
