package cc.infoq.common.mybatis.utils;

import cc.infoq.common.utils.SpringUtils;
import com.baomidou.mybatisplus.core.incrementer.IdentifierGenerator;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.context.support.GenericApplicationContext;

import java.util.concurrent.atomic.AtomicLong;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

@Tag("dev")
class IdGeneratorUtilTest {

    private static GenericApplicationContext context;

    @BeforeAll
    static void initSpringContext() {
        context = new GenericApplicationContext();
        context.registerBean(IdentifierGenerator.class, StubIdentifierGenerator::new);
        context.refresh();
        new SpringUtils().setApplicationContext(context);
    }

    @AfterAll
    static void closeContext() {
        if (context != null) {
            context.close();
        }
    }

    @Test
    void nextIdMethodsShouldUseSpringIdentifierGenerator() {
        Number numberId = IdGeneratorUtil.nextId("biz");
        String stringId = IdGeneratorUtil.nextStringId("biz");
        String id = IdGeneratorUtil.nextId();
        Long longId = IdGeneratorUtil.nextLongId();
        Number number = IdGeneratorUtil.nextNumberId();

        assertEquals(2001L, numberId.longValue());
        assertEquals("2002", stringId);
        assertEquals("2003", id);
        assertEquals(2004L, longId);
        assertEquals(2005L, number.longValue());
        assertEquals("ORD2006", IdGeneratorUtil.nextIdWithPrefix("ORD"));
    }

    @Test
    void uuidMethodsShouldReturnNonBlankStrings() {
        String uuid = IdGeneratorUtil.nextUUID();
        String customUuid = IdGeneratorUtil.nextUUID("biz");
        String prefixed = IdGeneratorUtil.nextUUIDWithPrefix("PRE-");

        assertEquals(32, uuid.length());
        assertEquals("UUID-biz", customUuid);
        assertTrue(prefixed.startsWith("PRE-"));
        assertTrue(prefixed.length() > 10);
        assertNotNull(prefixed);
    }

    private static final class StubIdentifierGenerator implements IdentifierGenerator {

        private final AtomicLong sequence = new AtomicLong(2000L);

        @Override
        public Number nextId(Object entity) {
            return sequence.incrementAndGet();
        }

        @Override
        public String nextUUID(Object entity) {
            return "UUID-" + entity;
        }
    }
}
