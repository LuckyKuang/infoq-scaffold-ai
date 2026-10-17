package cc.infoq.common.mybatis.handler;

import cc.infoq.common.domain.model.LoginUser;
import cc.infoq.common.exception.ServiceException;
import cc.infoq.common.mybatis.core.domain.BaseEntity;
import cc.infoq.common.security.auth.LoginUserContext;
import cc.infoq.common.utils.ObjectUtils;
import cn.hutool.core.util.ObjectUtil;
import cn.hutool.http.HttpStatus;
import com.baomidou.mybatisplus.core.handlers.MetaObjectHandler;
import lombok.extern.slf4j.Slf4j;
import org.apache.ibatis.reflection.MetaObject;

import java.util.Date;

/**
 * MP注入处理器
 *
 * @author Pontus
 */
@Slf4j
public class InjectionMetaObjectHandler implements MetaObjectHandler {

    /**
     * 插入填充方法，用于在插入数据时自动填充实体对象中的创建时间、更新时间、创建人、更新人等信息
     *
     * @param metaObject 元对象，用于获取原始对象并进行填充
     */
    @Override
    public void insertFill(MetaObject metaObject) {
        try {
            if (ObjectUtil.isNotNull(metaObject) && metaObject.getOriginalObject() instanceof BaseEntity baseEntity) {
                // 获取当前时间作为创建时间和更新时间，如果创建时间不为空，则使用创建时间，否则使用当前时间
                Date current = ObjectUtils.notNull(baseEntity.getCreateTime(), new Date());
                baseEntity.setCreateTime(current);
                baseEntity.setUpdateTime(current);

                // 如果创建人为空，则填充当前登录用户的信息
                if (ObjectUtil.isNull(baseEntity.getCreateBy())) {
                    LoginUser loginUser = getLoginUser();
                    Long userId = loginUser.getUserId();
                    // 填充创建人、更新人和创建部门信息
                    baseEntity.setCreateBy(userId);
                    baseEntity.setUpdateBy(userId);
                    baseEntity.setCreateDept(ObjectUtils.notNull(baseEntity.getCreateDept(), loginUser.getDeptId()));
                }
            } else {
                Date date = new Date();
                this.strictInsertFill(metaObject, "createTime", Date.class, date);
                this.strictInsertFill(metaObject, "updateTime", Date.class, date);
            }
        } catch (ServiceException e) {
            throw e;
        } catch (Exception e) {
            throw new ServiceException("自动注入异常 => " + e.getMessage(), HttpStatus.HTTP_UNAUTHORIZED);
        }
    }

    /**
     * 更新填充方法，用于在更新数据时自动填充实体对象中的更新时间和更新人信息
     *
     * @param metaObject 元对象，用于获取原始对象并进行填充
     */
    @Override
    public void updateFill(MetaObject metaObject) {
        try {
            if (ObjectUtil.isNotNull(metaObject) && metaObject.getOriginalObject() instanceof BaseEntity baseEntity) {
                // 获取当前时间作为更新时间，无论原始对象中的更新时间是否为空都填充
                Date current = new Date();
                baseEntity.setUpdateTime(current);

                // 获取当前登录用户的ID，并填充更新人信息
                Long userId = getUserId();
                baseEntity.setUpdateBy(userId);
            } else {
                this.strictUpdateFill(metaObject, "updateTime", Date.class, new Date());
            }
        } catch (ServiceException e) {
            throw e;
        } catch (Exception e) {
            throw new ServiceException("自动注入异常 => " + e.getMessage(), HttpStatus.HTTP_UNAUTHORIZED);
        }
    }

    /**
     * 获取当前登录用户信息
     *
     * @return 当前登录用户的信息
     */
    private LoginUser getLoginUser() {
        LoginUser loginUser = LoginUserContext.getLoginUser();
        if (ObjectUtil.isNull(loginUser) || ObjectUtil.isNull(loginUser.getUserId())) {
            throw new ServiceException("自动注入异常 => 当前登录用户缺失", HttpStatus.HTTP_UNAUTHORIZED);
        }
        return loginUser;
    }

    /**
     * 获取当前登录用户ID
     *
     * @return 当前用户ID
     */
    private Long getUserId() {
        Long userId = LoginUserContext.getUserId();
        if (ObjectUtil.isNull(userId)) {
            throw new ServiceException("自动注入异常 => 当前登录用户ID缺失", HttpStatus.HTTP_UNAUTHORIZED);
        }
        return userId;
    }

}
