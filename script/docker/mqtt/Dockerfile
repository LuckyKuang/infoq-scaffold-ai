FROM maven:3.9.12-eclipse-temurin-17

RUN apt-get update \
    && apt-get install --no-install-recommends -y ca-certificates curl openssl \
    && rm -rf /var/lib/apt/lists/*

COPY generate-certificates.sh init-emqx.sh prepare-run.sh /opt/infoq-mqtt/

RUN chmod 0555 /opt/infoq-mqtt/generate-certificates.sh \
    && chmod 0555 /opt/infoq-mqtt/init-emqx.sh \
    && chmod 0555 /opt/infoq-mqtt/prepare-run.sh