package cc.infoq.common.mqtt.service;

import cc.infoq.common.mqtt.*;
import cc.infoq.common.mqtt.config.MqttProperties;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.function.Supplier;

public class MqttClientRegistry implements MqttPublisher, AutoCloseable {

    private static final Logger log = LoggerFactory.getLogger(MqttClientRegistry.class);

    private final MqttProperties properties;
    private final MqttPluginMonitor monitor;
    private final Map<MqttProtocol, MqttProtocolClient> clients = new EnumMap<>(MqttProtocol.class);

    public MqttClientRegistry(MqttProperties properties,
                              MqttPluginMonitor monitor,
                              List<MqttMessageHandler> handlers) {
        this.properties = properties;
        this.monitor = monitor;
        try {
            if (properties.getV3().isEnabled()) {
                createClient(MqttProtocol.V3_1_1, () -> new PahoV3MqttClient(properties.getV3(), handlers, monitor));
            }
            if (properties.getV5().isEnabled()) {
                createClient(MqttProtocol.V5, () -> new PahoV5MqttClient(properties.getV5(), handlers, monitor));
            }
            connectEnabledProtocols();
        } catch (RuntimeException ex) {
            close();
            throw ex;
        }
    }

    MqttClientRegistry(MqttProperties properties,
                       MqttPluginMonitor monitor,
                       Map<MqttProtocol, MqttProtocolClient> protocolClients) {
        this.properties = properties;
        this.monitor = monitor;
        try {
            this.clients.putAll(protocolClients);
            connectEnabledProtocols();
        } catch (RuntimeException ex) {
            close();
            throw ex;
        }
    }

    @Override
    public void publish(MqttPublishCommand command) {
        MqttProtocolClient client = clients.get(command.protocol());
        if (client == null) {
            if (isProtocolEnabled(command.protocol())) {
                throw new MqttUnavailableException("MQTT " + command.protocol() + " is unavailable");
            }
            throw new MqttUnavailableException("MQTT " + command.protocol() + " is disabled");
        }
        if (!client.isConnected()) {
            throw new MqttUnavailableException("MQTT " + command.protocol() + " is unavailable");
        }
        long startedAt = System.nanoTime();
        try {
            client.publish(command);
            monitor.published(command.protocol(), System.nanoTime() - startedAt);
        } catch (Exception ex) {
            monitor.publishFailed(command.protocol(), ex, System.nanoTime() - startedAt);
            throw new MqttUnavailableException("MQTT " + command.protocol() + " publish failed", ex);
        }
    }

    @Override
    public void close() {
        clients.forEach((protocol, client) -> {
            try {
                client.close();
            } catch (Exception ex) {
                log.warn("MQTT {} close failed: {}", protocol, ex.getClass().getSimpleName());
            }
        });
    }

    private void connectEnabledProtocols() {
        for (MqttProtocol protocol : MqttProtocol.values()) {
            MqttProtocolClient client = clients.get(protocol);
            if (client == null) {
                continue;
            }
            try {
                client.connect();
            } catch (Exception ex) {
                monitor.connectionFailed(protocol, ex);
                if (properties.isRequired()) {
                    throw new MqttUnavailableException("MQTT " + protocol + " connection failed", ex);
                }
                closeClient(protocol, client);
                clients.remove(protocol);
                log.warn("MQTT {} connection unavailable: {}", protocol, ex.getClass().getSimpleName());
            }
        }
    }

    private void createClient(MqttProtocol protocol, Supplier<MqttProtocolClient> supplier) {
        try {
            clients.put(protocol, supplier.get());
        } catch (RuntimeException ex) {
            monitor.connectionFailed(protocol, ex);
            if (properties.isRequired()) {
                throw new MqttUnavailableException("MQTT " + protocol + " client creation failed", ex);
            }
            log.warn("MQTT {} client creation unavailable: {}", protocol, ex.getClass().getSimpleName());
        }
    }

    private boolean isProtocolEnabled(MqttProtocol protocol) {
        return protocol == MqttProtocol.V3_1_1 ? properties.getV3().isEnabled() : properties.getV5().isEnabled();
    }

    private void closeClient(MqttProtocol protocol, MqttProtocolClient client) {
        try {
            client.close();
        } catch (Exception ex) {
            log.warn("MQTT {} close failed: {}", protocol, ex.getClass().getSimpleName());
        }
    }
}
