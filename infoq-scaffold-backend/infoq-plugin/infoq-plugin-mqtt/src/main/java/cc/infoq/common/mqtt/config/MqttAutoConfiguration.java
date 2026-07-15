package cc.infoq.common.mqtt.config;

import cc.infoq.common.mqtt.MqttMessageHandler;
import cc.infoq.common.mqtt.MqttPublisher;
import cc.infoq.common.mqtt.MqttStatusProvider;
import cc.infoq.common.mqtt.service.DisabledMqttPublisher;
import cc.infoq.common.mqtt.service.MqttClientRegistry;
import cc.infoq.common.mqtt.service.MqttPluginMonitor;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;

@AutoConfiguration
@EnableConfigurationProperties(MqttProperties.class)
public class MqttAutoConfiguration {

    @Bean
    public MqttPublisher mqttPublisher(ObjectProvider<MqttClientRegistry> registryProvider) {
        MqttClientRegistry registry = registryProvider.getIfAvailable();
        return registry == null ? new DisabledMqttPublisher() : registry;
    }

    @Bean
    @ConditionalOnProperty(prefix = "infoq.mqtt", name = "enabled", havingValue = "true")
    public MqttPluginMonitor mqttPluginMonitor(MqttProperties properties) {
        MqttPropertiesValidator.validate(properties);
        return new MqttPluginMonitor(properties);
    }

    @Bean(destroyMethod = "close")
    @ConditionalOnProperty(prefix = "infoq.mqtt", name = "enabled", havingValue = "true")
    public MqttClientRegistry mqttClientRegistry(MqttProperties properties,
                                                 MqttPluginMonitor monitor,
                                                 ObjectProvider<MqttMessageHandler> handlers) {
        return new MqttClientRegistry(properties, monitor, handlers.orderedStream().toList());
    }

    @Bean
    @ConditionalOnProperty(prefix = "infoq.mqtt", name = "enabled", havingValue = "true")
    public MqttStatusProvider mqttStatusProvider(MqttPluginMonitor monitor) {
        return monitor::status;
    }
}
