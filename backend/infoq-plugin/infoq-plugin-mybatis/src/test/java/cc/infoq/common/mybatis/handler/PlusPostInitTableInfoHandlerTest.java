package cc.infoq.common.mybatis.handler;

import cc.infoq.common.utils.SpringUtils;
import cn.hutool.core.util.ReflectUtil;
import com.baomidou.mybatisplus.core.metadata.TableInfo;
import org.apache.ibatis.session.Configuration;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.context.support.GenericApplicationContext;
import org.springframework.mock.env.MockEnvironment;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

@Tag("dev")
class PlusPostInitTableInfoHandlerTest {

    private final PlusPostInitTableInfoHandler handler = new PlusPostInitTableInfoHandler();

    @Test
    void postTableInfoShouldDisableLogicDeleteWhenConfiguredFalse() {
        GenericApplicationContext context = newContext("false");
        try {
            TableInfo tableInfo = new TableInfo(new Configuration(), DemoEntity.class);
            ReflectUtil.setFieldValue(tableInfo, "withLogicDelete", true);

            handler.postTableInfo(tableInfo, new Configuration());

            assertFalse(tableInfo.isWithLogicDelete());
        } finally {
            context.close();
        }
    }

    @Test
    void postTableInfoShouldKeepLogicDeleteWhenConfiguredTrue() {
        GenericApplicationContext context = newContext("true");
        try {
            TableInfo tableInfo = new TableInfo(new Configuration(), DemoEntity.class);
            ReflectUtil.setFieldValue(tableInfo, "withLogicDelete", true);

            handler.postTableInfo(tableInfo, new Configuration());

            assertTrue(tableInfo.isWithLogicDelete());
        } finally {
            context.close();
        }
    }

    private static GenericApplicationContext newContext(String enableLogicDelete) {
        GenericApplicationContext context = new GenericApplicationContext();
        MockEnvironment environment = new MockEnvironment();
        environment.setProperty("mybatis-plus.enableLogicDelete", enableLogicDelete);
        context.setEnvironment(environment);
        context.refresh();
        new SpringUtils().setApplicationContext(context);
        return context;
    }

    private static class DemoEntity {
    }
}
