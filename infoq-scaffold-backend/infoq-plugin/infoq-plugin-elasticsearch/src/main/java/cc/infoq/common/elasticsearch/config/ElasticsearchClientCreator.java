package cc.infoq.common.elasticsearch.config;

@FunctionalInterface
interface ElasticsearchClientCreator {

    ElasticsearchClientResources create(ElasticsearchProperties properties);
}
