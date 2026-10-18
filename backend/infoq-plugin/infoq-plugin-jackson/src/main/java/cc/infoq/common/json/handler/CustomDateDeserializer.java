package cc.infoq.common.json.handler;

import cc.infoq.common.utils.ObjectUtils;
import cn.hutool.core.date.DateTime;
import cn.hutool.core.date.DateUtil;
import tools.jackson.core.JacksonException;
import tools.jackson.core.JsonParser;
import tools.jackson.databind.DeserializationContext;
import tools.jackson.databind.ValueDeserializer;

import java.util.Date;

/**
 * 自定义 Date 类型反序列化处理器（支持多种格式）。
 *
 * @author Pontus
 */
public class CustomDateDeserializer extends ValueDeserializer<Date> {

    /**
     * 反序列化逻辑：将字符串转换为 Date 对象。
     *
     * @param p    JSON 解析器，用于获取字符串值
     * @param ctxt 上下文环境
     * @return 转换后的 Date 对象，若为空字符串返回 null
     * @throws JacksonException 当字符串格式非法或转换失败时抛出
     */
    @Override
    public Date deserialize(JsonParser p, DeserializationContext ctxt) throws JacksonException {
        DateTime parse = DateUtil.parse(p.getText());
        if (ObjectUtils.isNull(parse)) {
            return null;
        }
        return parse.toJdkDate();
    }
}
