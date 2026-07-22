package cc.infoq.common.mqtt.service;

import cc.infoq.common.mqtt.MqttInboundMessage;
import cc.infoq.common.mqtt.MqttMessageHandler;
import cc.infoq.common.mqtt.MqttProtocol;
import cc.infoq.common.mqtt.MqttPublishCommand;
import cc.infoq.common.mqtt.config.MqttProperties;
import org.eclipse.paho.client.mqttv3.*;
import org.eclipse.paho.client.mqttv3.persist.MemoryPersistence;

import java.time.Instant;
import java.util.Arrays;
import java.util.List;
import java.util.concurrent.atomic.AtomicLong;

final class PahoV3MqttClient implements MqttProtocolClient, MqttCallbackExtended {

    private final MqttProperties.ProtocolProperties properties;
    private final List<MqttMessageHandler> handlers;
    private final MqttPluginMonitor monitor;
    private final MqttAsyncClient client;
    private final AtomicLong subscriptionEpoch = new AtomicLong();
    private volatile boolean subscriptionsReady;

    PahoV3MqttClient(MqttProperties.ProtocolProperties properties,
                     List<MqttMessageHandler> handlers,
                     MqttPluginMonitor monitor) {
        this.properties = properties;
        this.handlers = handlers;
        this.monitor = monitor;
        try {
            this.client = new MqttAsyncClient(properties.getUri(), properties.getClientId(), new MemoryPersistence());
            this.client.setCallback(this);
        } catch (MqttException ex) {
            throw new IllegalStateException("MQTT V3 client creation failed", ex);
        }
    }

    @Override
    public void connect() throws MqttException {
        MqttConnectOptions options = new MqttConnectOptions();
        options.setAutomaticReconnect(properties.isAutomaticReconnect());
        options.setCleanSession(true);
        options.setConnectionTimeout(Math.toIntExact(properties.getConnectTimeout().toSeconds()));
        if (properties.getUsername() != null && !properties.getUsername().isBlank()) {
            options.setUserName(properties.getUsername());
        }
        if (properties.getPassword() != null && !properties.getPassword().isBlank()) {
            options.setPassword(properties.getPassword().toCharArray());
        }
        client.connect(options).waitForCompletion(properties.getCompletionTimeout().toMillis());
        subscribeConfiguredTopics();
        subscriptionsReady = true;
        monitor.connected(MqttProtocol.V3_1_1, false);
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
    public void connectComplete(boolean reconnect, String serverUri) {
        if (reconnect) {
            subscriptionsReady = false;
            resubscribeConfiguredTopics();
        }
    }

    @Override
    public void connectionLost(Throwable cause) {
        subscriptionEpoch.incrementAndGet();
        subscriptionsReady = false;
        monitor.disconnected(MqttProtocol.V3_1_1, cause);
    }

    @Override
    public void messageArrived(String topic, MqttMessage message) {
        MqttInboundMessage inbound = new MqttInboundMessage(MqttProtocol.V3_1_1, topic, message.getPayload(),
            message.getQos(), message.isRetained(), message.isDuplicate(), Instant.now(), null);
        MqttInboundMessageDispatcher.dispatch(MqttProtocol.V3_1_1, inbound, handlers, monitor);
    }

    @Override
    public void deliveryComplete(IMqttDeliveryToken token) {
    }

    private void subscribeConfiguredTopics() throws MqttException {
        for (String topic : properties.getSubscriptions()) {
            client.subscribe(topic, properties.getQos()).waitForCompletion(properties.getCompletionTimeout().toMillis());
            monitor.subscribed(MqttProtocol.V3_1_1);
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
            client.subscribe(topics, qos, null, new IMqttActionListener() {
                @Override
                public void onSuccess(IMqttToken token) {
                    if (subscriptionEpoch.get() != epoch) {
                        return;
                    }
                    for (int ignored = 0; ignored < topics.length; ignored++) {
                        monitor.subscribed(MqttProtocol.V3_1_1);
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
        monitor.connected(MqttProtocol.V3_1_1, true);
    }

    private void failReconnectSubscription(long epoch, Throwable failure) {
        if (subscriptionEpoch.compareAndSet(epoch, epoch + 1)) {
            MqttReconnectFailureHandler.closeUnavailableClient(MqttProtocol.V3_1_1, this, monitor, failure);
        }
    }
}
