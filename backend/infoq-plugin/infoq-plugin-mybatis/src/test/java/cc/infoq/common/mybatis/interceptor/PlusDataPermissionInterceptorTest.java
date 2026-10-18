package cc.infoq.common.mybatis.interceptor;

import cc.infoq.common.mybatis.handler.PlusDataPermissionHandler;
import cc.infoq.common.utils.SpringUtils;
import com.baomidou.mybatisplus.extension.plugins.handler.MultiDataPermissionHandler;
import net.sf.jsqlparser.expression.Expression;
import net.sf.jsqlparser.parser.CCJSqlParserUtil;
import net.sf.jsqlparser.schema.Table;
import net.sf.jsqlparser.statement.Statement;
import net.sf.jsqlparser.statement.delete.Delete;
import net.sf.jsqlparser.statement.select.PlainSelect;
import net.sf.jsqlparser.statement.select.Select;
import net.sf.jsqlparser.statement.update.Update;
import org.apache.ibatis.builder.StaticSqlSource;
import org.apache.ibatis.executor.Executor;
import org.apache.ibatis.executor.statement.RoutingStatementHandler;
import org.apache.ibatis.executor.statement.StatementHandler;
import org.apache.ibatis.mapping.BoundSql;
import org.apache.ibatis.mapping.MappedStatement;
import org.apache.ibatis.mapping.SqlCommandType;
import org.apache.ibatis.session.Configuration;
import org.apache.ibatis.session.RowBounds;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.context.support.GenericApplicationContext;

import java.lang.reflect.Field;
import java.sql.Connection;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@Tag("dev")
class PlusDataPermissionInterceptorTest {

    private static final GenericApplicationContext CONTEXT = new GenericApplicationContext();

    @BeforeAll
    static void initSpringContext() {
        CONTEXT.refresh();
        new SpringUtils().setApplicationContext(CONTEXT);
    }

    @AfterAll
    static void closeContext() {
        CONTEXT.close();
    }

    @Test
    @DisplayName("beforeQuery: should rewrite select sql when data permission is valid")
    void beforeQueryShouldRewriteSqlWhenValid() throws Exception {
        PlusDataPermissionInterceptor interceptor = new PlusDataPermissionInterceptor();
        PlusDataPermissionHandler handler = mock(PlusDataPermissionHandler.class);
        setHandler(interceptor, handler);
        when(handler.invalid()).thenReturn(false);
        when(handler.getSqlSegment(any(), eq(true)))
            .thenReturn(CCJSqlParserUtil.parseCondExpression("dept_id = 100"));

        MappedStatement ms = mappedStatement("cc.infoq.mapper.DeptMapper.selectList",
            SqlCommandType.SELECT, "select * from sys_dept");
        BoundSql boundSql = new BoundSql(ms.getConfiguration(), "select * from sys_dept", List.of(), null);

        interceptor.beforeQuery(mock(Executor.class), ms, null, RowBounds.DEFAULT, null, boundSql);

        assertTrue(boundSql.getSql().toLowerCase().contains("dept_id = 100"));
        verify(handler).getSqlSegment(any(), eq(true));
    }

    @Test
    @DisplayName("beforePrepare: should rewrite update/delete sql when data permission is valid")
    void beforePrepareShouldRewriteSqlWhenValid() throws Exception {
        PlusDataPermissionInterceptor interceptor = new PlusDataPermissionInterceptor();
        PlusDataPermissionHandler handler = mock(PlusDataPermissionHandler.class);
        setHandler(interceptor, handler);
        when(handler.invalid()).thenReturn(false);
        when(handler.getSqlSegment(any(), eq(false)))
            .thenReturn(CCJSqlParserUtil.parseCondExpression("dept_id = 200"));

        StatementHandler updateHandler = routingHandler("cc.infoq.mapper.UserMapper.updateById",
            SqlCommandType.UPDATE, "update sys_user set user_name = 'n' where user_id = 1");
        interceptor.beforePrepare(updateHandler, mock(Connection.class), 30);
        assertTrue(updateHandler.getBoundSql().getSql().toLowerCase().contains("dept_id = 200"));

        StatementHandler deleteHandler = routingHandler("cc.infoq.mapper.UserMapper.deleteById",
            SqlCommandType.DELETE, "delete from sys_user where user_id = 1");
        interceptor.beforePrepare(deleteHandler, mock(Connection.class), 30);
        assertTrue(deleteHandler.getBoundSql().getSql().toLowerCase().contains("dept_id = 200"));

        verify(handler, times(2)).getSqlSegment(any(), eq(false));
    }

    @Test
    @DisplayName("processSelect/setWhere: should handle plain and set-operation select branches")
    void processSelectAndSetWhereShouldCoverBranches() throws Exception {
        PlusDataPermissionInterceptor interceptor = new PlusDataPermissionInterceptor();
        PlusDataPermissionHandler handler = mock(PlusDataPermissionHandler.class);
        setHandler(interceptor, handler);
        when(handler.getSqlSegment(any(), eq(true)))
            .thenReturn(CCJSqlParserUtil.parseCondExpression("dept_id = 300"));

        Select unionSelect = (Select) CCJSqlParserUtil.parse(
            "select * from sys_dept union select * from sys_user");
        interceptor.processSelect(unionSelect, 0, unionSelect.toString(), "ms");
        assertTrue(unionSelect.toString().toLowerCase().contains("dept_id = 300"));

        PlainSelect plainSelect = (PlainSelect) ((Select) CCJSqlParserUtil.parse("select * from sys_post"))
            .getSelectBody();
        when(handler.getSqlSegment(any(), eq(true))).thenReturn(null);
        interceptor.setWhere(plainSelect, "ms");
        assertNull(plainSelect.getWhere());
    }

    @Test
    @DisplayName("processUpdate/processDelete/buildTableExpression: should apply delegated expressions")
    void processUpdateDeleteAndBuildTableExpressionShouldDelegate() throws Exception {
        PlusDataPermissionInterceptor interceptor = new PlusDataPermissionInterceptor();
        PlusDataPermissionHandler handler = mock(PlusDataPermissionHandler.class);
        setHandler(interceptor, handler);
        Expression expression = CCJSqlParserUtil.parseCondExpression("dept_id = 400");
        when(handler.getSqlSegment(any(), eq(false))).thenReturn(expression);

        Statement updateStatement = CCJSqlParserUtil.parse("update sys_user set user_name = 'n' where user_id = 1");
        interceptor.processUpdate((Update) updateStatement, 0, updateStatement.toString(), "ms");
        assertTrue(updateStatement.toString().toLowerCase().contains("dept_id = 400"));

        Statement deleteStatement = CCJSqlParserUtil.parse("delete from sys_user where user_id = 1");
        interceptor.processDelete((Delete) deleteStatement, 0, deleteStatement.toString(), "ms");
        assertTrue(deleteStatement.toString().toLowerCase().contains("dept_id = 400"));

        MultiSqlSegmentHandler multiHandler = new MultiSqlSegmentHandler(expression);
        setHandler(interceptor, multiHandler);
        Expression built = interceptor.buildTableExpression(new Table("sys_user"), null, "segment");
        assertSame(expression, built);
    }

    private static void setHandler(PlusDataPermissionInterceptor interceptor, PlusDataPermissionHandler handler) throws Exception {
        Field field = PlusDataPermissionInterceptor.class.getDeclaredField("dataPermissionHandler");
        field.setAccessible(true);
        field.set(interceptor, handler);
    }

    private static MappedStatement mappedStatement(String id, SqlCommandType commandType, String sql) {
        Configuration configuration = new Configuration();
        return new MappedStatement.Builder(configuration, id, new StaticSqlSource(configuration, sql), commandType)
            .build();
    }

    private static StatementHandler routingHandler(String id, SqlCommandType commandType, String sql) {
        MappedStatement mappedStatement = mappedStatement(id, commandType, sql);
        return new RoutingStatementHandler(mock(Executor.class), mappedStatement, null, RowBounds.DEFAULT, null, null);
    }

    private static final class MultiSqlSegmentHandler extends PlusDataPermissionHandler implements MultiDataPermissionHandler {
        private final Expression expression;

        private MultiSqlSegmentHandler(Expression expression) {
            this.expression = expression;
        }

        @Override
        public Expression getSqlSegment(Table table, Expression where, String whereSegment) {
            return expression;
        }
    }
}
