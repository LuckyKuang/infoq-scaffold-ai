package cc.infoq.system.domain.bo;

import cc.infoq.common.mybatis.core.domain.BaseEntity;
import cc.infoq.common.validate.AddGroup;
import cc.infoq.common.validate.EditGroup;
import cc.infoq.common.validate.StatusGroup;
import cc.infoq.system.domain.entity.SysClient;
import io.github.linpeilie.annotations.AutoMapper;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.util.List;

/**
 * 授权管理业务对象 sys_client
 *
 * @author Pontus
 */
@Data
@EqualsAndHashCode(callSuper = true)
@AutoMapper(target = SysClient.class, reverseConvertGenerate = false)
public class SysClientBo extends BaseEntity {

    /**
     * id
     */
    @NotNull(message = "id不能为空", groups = { EditGroup.class })
    private Long id;

    /**
     * 客户端id
     */
    @NotBlank(message = "客户端id不能为空", groups = { StatusGroup.class })
    private String clientId;

    /**
     * 客户端key
     */
    @NotBlank(message = "客户端key不能为空", groups = { AddGroup.class, EditGroup.class })
    private String clientKey;

    /**
     * 客户端秘钥
     */
    @NotBlank(message = "客户端秘钥不能为空", groups = { AddGroup.class, EditGroup.class })
    private String clientSecret;

    /**
     * 授权类型
     */
    @NotNull(message = "授权类型不能为空", groups = { AddGroup.class, EditGroup.class })
    private List<String> grantTypeList;

    /**
     * 授权类型
     */
    private String grantType;

    /**
     * 设备类型
     */
    private String deviceType;

    /**
     * token活跃超时时间
     */
    private Long activeTimeout;

    /**
     * token固定超时时间
     */
    private Long timeout;

    /**
     * 状态（0正常 1停用）
     */
    @NotBlank(message = "状态不能为空", groups = { StatusGroup.class })
    private String status;


}
