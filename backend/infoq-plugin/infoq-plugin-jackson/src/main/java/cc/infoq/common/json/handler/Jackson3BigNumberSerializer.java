package cc.infoq.common.json.handler;

import tools.jackson.core.JsonGenerator;
import tools.jackson.databind.SerializationContext;
import tools.jackson.databind.ser.jdk.NumberSerializer;

import java.math.BigInteger;

/**
 * Jackson 3 路径的大数保护：超出 JS 安全整数范围的整数序列化为字符串，
 * 避免 snowflake 主键在浏览器端被 JSON.parse 舍入后错位。
 *
 * @author Pontus
 */
public class Jackson3BigNumberSerializer extends NumberSerializer {

    private static final BigInteger MAX_SAFE_INTEGER = BigInteger.valueOf(9007199254740991L);
    private static final BigInteger MIN_SAFE_INTEGER = MAX_SAFE_INTEGER.negate();

    public static final Jackson3BigNumberSerializer INSTANCE = new Jackson3BigNumberSerializer();

    public Jackson3BigNumberSerializer() {
        super(Number.class);
    }

    @Override
    public void serialize(Number value, JsonGenerator gen, SerializationContext context) {
        if (isSafeInteger(value)) {
            super.serialize(value, gen, context);
        } else {
            gen.writeString(value.toString());
        }
    }

    private static boolean isSafeInteger(Number value) {
        if (value instanceof BigInteger big) {
            return big.compareTo(MIN_SAFE_INTEGER) >= 0 && big.compareTo(MAX_SAFE_INTEGER) <= 0;
        }
        long raw = value.longValue();
        return raw >= MIN_SAFE_INTEGER.longValue() && raw <= MAX_SAFE_INTEGER.longValue();
    }
}