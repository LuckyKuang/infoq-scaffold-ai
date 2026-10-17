package cc.infoq.system;

import cc.infoq.system.domain.entity.SysCache;
import cc.infoq.system.domain.entity.SysClient;
import cc.infoq.system.domain.entity.SysConfig;
import cc.infoq.system.domain.entity.SysDept;
import cc.infoq.system.domain.entity.SysDictData;
import cc.infoq.system.domain.entity.SysDictType;
import cc.infoq.system.domain.entity.SysInviteCode;
import cc.infoq.system.domain.entity.SysJob;
import cc.infoq.system.domain.entity.SysJobLog;
import cc.infoq.system.domain.entity.SysLoginInfo;
import cc.infoq.system.domain.entity.SysMenu;
import cc.infoq.system.domain.entity.SysMessage;
import cc.infoq.system.domain.entity.SysMessageRecipient;
import cc.infoq.system.domain.entity.SysNotice;
import cc.infoq.system.domain.entity.SysOauthIdentity;
import cc.infoq.system.domain.entity.SysOauthProvider;
import cc.infoq.system.domain.entity.SysOperLog;
import cc.infoq.system.domain.entity.SysOss;
import cc.infoq.system.domain.entity.SysOssConfig;
import cc.infoq.system.domain.entity.SysOssExt;
import cc.infoq.system.domain.entity.SysPost;
import cc.infoq.system.domain.entity.SysRole;
import cc.infoq.system.domain.entity.SysRoleDept;
import cc.infoq.system.domain.entity.SysRoleMenu;
import cc.infoq.system.domain.entity.SysUser;
import cc.infoq.system.domain.entity.SysUserOnline;
import cc.infoq.system.domain.entity.SysUserPost;
import cc.infoq.system.domain.entity.SysUserRole;
import com.baomidou.mybatisplus.core.metadata.TableInfoHelper;
import org.apache.ibatis.builder.MapperBuilderAssistant;
import org.apache.ibatis.session.Configuration;

import java.util.List;

/**
 * 单元测试用的 MyBatis-Plus TableInfo / lambda cache 初始化。
 *
 * <p>MyBatis-Plus 3.5.17 起，构建 LambdaQueryWrapper / LambdaUpdateWrapper 解析实体列时，
 * 必须先注册对应实体的 TableInfo（生产环境由 SqlSessionFactory 构建 mapper 时自动完成），
 * 否则抛出 "can not find lambda cache for this entity"。Mockito 单测不经过 MyBatis 运行时，
 * 因此需要在测试初始化时显式注册。
 *
 * @author Pontus
 */
public final class TableInfoTestInitializer {

    private static final List<Class<?>> SYSTEM_ENTITIES = List.of(
        SysCache.class, SysClient.class, SysConfig.class, SysDept.class, SysDictData.class,
        SysDictType.class, SysInviteCode.class, SysJob.class, SysJobLog.class, SysLoginInfo.class,
        SysMenu.class, SysMessage.class, SysMessageRecipient.class, SysNotice.class,
        SysOauthIdentity.class, SysOauthProvider.class, SysOperLog.class, SysOss.class,
        SysOssConfig.class, SysOssExt.class, SysPost.class, SysRole.class, SysRoleDept.class,
        SysRoleMenu.class, SysUser.class, SysUserOnline.class, SysUserPost.class, SysUserRole.class);

    private TableInfoTestInitializer() {
    }

    /**
     * 注册系统模块全部实体的 TableInfo，使 Lambda 列解析在单测中可用。重复调用是幂等的。
     */
    public static void initSystemTableInfo() {
        MapperBuilderAssistant assistant = new MapperBuilderAssistant(new Configuration(), "test");
        for (Class<?> entityClass : SYSTEM_ENTITIES) {
            TableInfoHelper.remove(entityClass);
            TableInfoHelper.initTableInfo(assistant, entityClass);
        }
    }
}
