package cc.infoq.common.mqtt.service;

import cc.infoq.common.mqtt.*;
import cc.infoq.common.mqtt.config.MqttProperties;
import org.eclipse.paho.mqttv5.client.*;
import org.eclipse.paho.mqttv5.client.persist.MemoryPersistence;
import org.eclipse.paho.mqttv5.common.MqttException;
import org.eclipse.paho.mqttv5.common.MqttMessage;
import org.eclipse.paho.mqttv5.common.packet.UserProperty;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Arrays;
import java.util.List;
import java.util.concurrent.atomic.AtomicLong;

final class PahoV5MqttClient implements MqttProtocolClient, MqttCallback {

    private final MqttProperties.ProtocolProperties properties;
    private final List<MqttMessageHandler> handlers;
    private final MqttPluginMonitor monitor;
    private final MqttAsyncClient client;
    private final AtomicLong subscriptionEpoch = new AtomicLong();
    private volatile boolean subscriptionsReady;

    PahoV5MqttClient(MqttProperties.ProtocolProperties properties,
                     List<MqttMessageHandler> handlers,
                     MqttPluginMonitor monitor) {
        this.properties = properties;
        this.handlers = handlers;
        this.monitor = monitor;
        try {
            this.client = new MqttAsyncClient(properties.getUri(), properties.getClientId(), new MemoryPersistence());
            this.client.setCallback(this);
        } catch (MqttException ex) {
            throw new IllegalStateException("MQTT V5 client creation failed", ex);
        }
    }

    @Override
    public void connect() throws MqttException {
        MqttConnectionOptions options = new MqttConnectionOptions();
        options.setAutomaticReconnect(properties.isAutomaticReconnect());
        options.setCleanStart(true);
        options.setConnectionTimeout(Math.toIntExact(properties.getConnectTimeout().toSeconds()));
        if (properties.getUsername() != null && !properties.getUsername().isBlank()) {
            options.setUserName(properties.getUsername());
        }
        if (properties.getPassword() != null && !properties.getPassword().isBlank()) {
            options.setPassword(properties.getPassword().getBytes(StandardCharsets.UTF_8));
        }
        client.connect(options).waitForCompletion(properties.getCompletionTimeout().toMillis());
        subscribeConfiguredTopics();
        subscriptionsReady = true;
        monitor.connected(MqttProtocol.V5, false);
    }

    @Override
    public boolean isConnected() {
        return subscriptionsReady && client.isConnected();
    }

    @Override
    public void publish(MqttPublishCommand command) throws MqttException {
        MqttMessage message = new MqttMessage(command.payload());
        message.setQos(command.qos());
        message.setRetained(command.retained());
        if (command.v5Properties() != null) {
            message.setProperties(toPahoProperties(command.v5Properties()));
        }
        client.publish(command.topic(), message).waitForCompletion(properties.getCompletionTimeout().toMillis());
    }

    @Override
    public void close() throws MqttException {
        subscriptionEpoch.incrementAndGet();
        subscriptionsReady = false;
        if (client.isConnected()) {
            client.disconnect(properties.getCompletionTimeout().toMillis());
        }
        client.close();
    }

    @Override
    public void disconnected(MqttDisconnectResponse disconnectResponse) {
        subscriptionEpoch.incrementAndGet();
        subscriptionsReady = false;
        monitor.disconnected(MqttProtocol.V5, disconnectResponse.getException());
    }

    @Override
    public void mqttErrorOccurred(MqttException exception) {
        monitor.connectionFailed(MqttProtocol.V5, exception);
    }

    @Override
    public void messageArrived(String topic, MqttMessage message) {
        MqttInboundMessage inbound = new MqttInboundMessage(MqttProtocol.V5, topic, message.getPayload(),
            message.getQos(), message.isRetained(), message.isDuplicate(), Instant.now(),
            fromPahoProperties(message.getProperties()));
        MqttInboundMessageDispatcher.dispatch(MqttProtocol.V5, inbound, handlers, monitor);
    }

    @Override
    public void deliveryComplete(IMqttToken token) {
    }

    @Override
    public void connectComplete(boolean reconnect, String serverUri) {
        if (reconnect) {
            subscriptionsReady = false;
            resubscribeConfiguredTopics();
        }
    }

    @Override
    public void authPacketArrived(int reasonCode,
                                  org.eclipse.paho.mqttv5.common.packet.MqttProperties properties) {
    }

    private void subscribeConfiguredTopics() throws MqttException {
        for (String topic : properties.getSubscriptions()) {
            client.subscribe(topic, properties.getQos()).waitForCompletion(properties.getCompletionTimeout().toMillis());
            monitor.subscribed(MqttProtocol.V5);
        }
    }

    private void resubscribeConfiguredTopics() {
        long epoch = subscriptionEpoch.incrementAndGet();
        List<String> subscriptions = properties.getSubscriptions();
        if (subscriptions.isEmpty()) {
            markReconnected(epoch);
            return;
        }
        String[] topics = subscriptions.toArray(String[]::new);
        int[] qos = new int[topics.length];
        Arrays.fill(qos, properties.getQos());
        try {
            client.subscribe(topics, qos, null, new MqttActionListener() {
                @Override
                public void onSuccess(IMqttToken token) {
                    if (subscriptionEpoch.get() != epoch) {
                        return;
                    }
                    for (int ignored = 0; ignored < topics.length; ignored++) {
                        monitor.subscribed(MqttProtocol.V5);
                    }
                    markReconnected(epoch);
                }

                @Override
                public void onFailure(IMqttToken token, Throwable failure) {
                    failReconnectSubscription(epoch, failure);
                }
            });
        } catch (MqttException ex) {
            failReconnectSubscription(epoch, ex);
        }
    }

    private void markReconnected(long epoch) {
        if (subscriptionEpoch.get() != epoch) {
            return;
        }
        subscriptionsReady = true;
        monitor.connected(MqttProtocol.V5, true);
    }

    private void failReconnectSubscription(long epoch, Throwable failure) {
        if (subscriptionEpoch.compareAndSet(epoch, epoch + 1)) {
            MqttReconnectFailureHandler.closeUnavailableClient(MqttProtocol.V5, this, monitor, failure);
        }
    }

    static org.eclipse.paho.mqttv5.common.packet.MqttProperties toPahoProperties(MqttV5Properties source) {
        org.eclipse.paho.mqttv5.common.packet.MqttProperties target =
            new org.eclipse.paho.mqttv5.common.packet.MqttProperties();
        target.setResponseTopic(source.responseTopic());
        target.setCorrelationData(source.correlationData());
        target.setContentType(source.contentType());
        target.setMessageExpiryInterval(source.messageExpiryIntervalSeconds());
        List<UserProperty> userProperties = source.userProperties().stream()
            .map(property -> new UserProperty(property.key(), property.value()))
            .toList();
        target.setUserProperties(userProperties);
        return target;
    }

    static MqttV5Properties fromPahoProperties(
        org.eclipse.paho.mqttv5.common.packet.MqttProperties source) {
        if (source == null) {
            return null;
        }
        List<UserProperty> sourceUserProperties = source.getUserProperties();
        List<MqttV5UserProperty> userProperties = sourceUserProperties == null ? List.of() : sourceUserProperties.stream()
            .map(property -> new MqttV5UserProperty(property.getKey(), property.getValue()))
            .toList();
        return new MqttV5Properties(source.getResponseTopic(), source.getCorrelationData(), source.getContentType(),
            source.getMessageExpiryInterval(), userProperties);
    }
}
