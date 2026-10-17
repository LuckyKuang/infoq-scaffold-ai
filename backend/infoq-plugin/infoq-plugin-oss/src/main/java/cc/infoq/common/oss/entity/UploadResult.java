package cc.infoq.common.oss.entity;

import lombok.Builder;
import lombok.Data;

/**
 * 上传返回体
 *
 * @author Pontus
 */
@Data
@Builder
public class UploadResult {

    /**
     * 文件路径
     */
    private String url;

    /**
     * 文件名
     */
    private String filename;

    /**
     * 已上传对象的实体标记（用来校验文件）
     */
    private String eTag;

}
