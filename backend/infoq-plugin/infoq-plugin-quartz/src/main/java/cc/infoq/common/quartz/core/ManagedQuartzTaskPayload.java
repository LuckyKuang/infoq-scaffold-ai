package cc.infoq.common.quartz.core;

import lombok.Data;

import java.io.Serial;
import java.io.Serializable;

/**
 * Quartz JobDataMap 负载
 *
 * @author Pontus
 */
@Data
public class ManagedQuartzTaskPayload implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    private Long jobId;

    private String triggerSource;
}
