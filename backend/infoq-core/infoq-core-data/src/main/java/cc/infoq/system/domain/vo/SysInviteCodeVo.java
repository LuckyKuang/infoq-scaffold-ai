package cc.infoq.system.domain.vo;

import cc.infoq.common.excel.annotation.ExcelDictFormat;
import cc.infoq.common.excel.convert.ExcelDictConvert;
import cc.infoq.system.domain.entity.SysInviteCode;
import cn.idev.excel.annotation.ExcelIgnoreUnannotated;
import cn.idev.excel.annotation.ExcelProperty;
import io.github.linpeilie.annotations.AutoMapper;
import lombok.Data;

import java.io.Serial;
import java.io.Serializable;
import java.util.Date;

/**
 * 邀请码视图对象 sys_invite_code.
 *
 * @author Pontus
 */
@Data
@ExcelIgnoreUnannotated
@AutoMapper(target = SysInviteCode.class)
public class SysInviteCodeVo implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    /**
     * 邀请码ID.
     */
    private Long inviteId;

    /**
     * 邀请码.
     */
    @ExcelProperty("邀请码")
    private String inviteCode;

    /**
     * 总状态.
     */
    @ExcelProperty(value = "总状态", converter = ExcelDictConvert.class)
    @ExcelDictFormat(dictType = "sys_invite_code_status")
    private String status;

    /**
     * 生成时间.
     */
    @ExcelProperty("生成时间")
    private Date createTime;

    /**
     * 使用时间.
     */
    @ExcelProperty("使用时间")
    private Date usedTime;

    /**
     * 使用人邮箱.
     */
    @ExcelProperty("使用人邮箱")
    private String usedUserEmail;

    /**
     * 使用人ID.
     */
    private Long usedUserId;

    /**
     * 生成人ID.
     */
    private Long createBy;

    /**
     * 生成人.
     */
    @ExcelProperty("生成人")
    private String creatorName;

    /**
     * 过期时间.
     */
    @ExcelProperty("过期时间")
    private Date expireTime;

    /**
     * 作废时间.
     */
    @ExcelProperty("作废时间")
    private Date canceledTime;

    /**
     * 作废原因.
     */
    @ExcelProperty("作废原因")
    private String canceledReason;

    /**
     * 备注.
     */
    @ExcelProperty("备注")
    private String remark;
}
