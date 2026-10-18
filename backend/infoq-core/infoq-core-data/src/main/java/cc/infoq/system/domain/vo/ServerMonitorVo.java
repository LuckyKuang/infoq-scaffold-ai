package cc.infoq.system.domain.vo;

import lombok.Data;

import java.io.Serial;
import java.io.Serializable;
import java.util.ArrayList;
import java.util.List;

/**
 * 服务监控视图对象
 *
 * @author Pontus
 */
@Data
public class ServerMonitorVo implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    private Cpu cpu;

    private Mem mem;

    private Jvm jvm;

    private Sys sys;

    private List<SysFile> sysFiles = new ArrayList<>();

    @Data
    public static class Cpu implements Serializable {

        @Serial
        private static final long serialVersionUID = 1L;

        private Integer cpuNum;

        private Double used;

        private Double sys;

        private Double wait;

        private Double free;
    }

    @Data
    public static class Mem implements Serializable {

        @Serial
        private static final long serialVersionUID = 1L;

        private Double total;

        private Double used;

        private Double free;

        private Double usage;
    }

    @Data
    public static class Jvm implements Serializable {

        @Serial
        private static final long serialVersionUID = 1L;

        private Double total;

        private Double max;

        private Double used;

        private Double free;

        private Double usage;

        private String name;

        private String version;

        private String startTime;

        private String runTime;
    }

    @Data
    public static class Sys implements Serializable {

        @Serial
        private static final long serialVersionUID = 1L;

        private String osName;

        private String osArch;
    }

    @Data
    public static class SysFile implements Serializable {

        @Serial
        private static final long serialVersionUID = 1L;

        private String dirName;

        private String sysTypeName;

        private String typeName;

        private String total;

        private String free;

        private String used;

        private Double usage;
    }
}
