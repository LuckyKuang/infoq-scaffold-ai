FROM maven:3.9.12-eclipse-temurin-17

RUN apt-get update \
    && apt-get install --no-install-recommends -y ca-certificates curl openssl \
    && rm -rf /var/lib/apt/lists/*

COPY generate-certificates.sh init-elasticsearch-security.sh prepare-run.sh /opt/infoq-elasticsearch/

RUN chmod 0555 /opt/infoq-elasticsearch/generate-certificates.sh \
    && chmod 0555 /opt/infoq-elasticsearch/init-elasticsearch-security.sh \
    && chmod 0555 /opt/infoq-elasticsearch/prepare-run.sh