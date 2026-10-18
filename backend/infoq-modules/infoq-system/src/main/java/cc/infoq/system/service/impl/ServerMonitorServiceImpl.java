package cc.infoq.system.service.impl;

import cc.infoq.common.exception.ServiceException;
import cc.infoq.common.utils.DateUtils;
import cc.infoq.system.domain.vo.ServerMonitorVo;
import cc.infoq.system.service.ServerMonitorService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import oshi.SystemInfo;
import oshi.hardware.CentralProcessor;
import oshi.hardware.CentralProcessor.TickType;
import oshi.hardware.GlobalMemory;
import oshi.hardware.HardwareAbstractionLayer;
import oshi.software.os.FileSystem;
import oshi.software.os.OSFileStore;
import oshi.software.os.OperatingSystem;
import oshi.util.Util;

import java.lang.management.ManagementFactory;
import java.lang.management.RuntimeMXBean;
import java.util.Date;
import java.util.List;
import java.util.Properties;

/**
 * Service monitor implementation backed by OSHI and JVM runtime data.
 *
 * @author Pontus
 */
@Slf4j
@Service
public class ServerMonitorServiceImpl implements ServerMonitorService {

    private static final long CPU_SAMPLE_DELAY_MS = 200L;

    @Override
    public ServerMonitorVo getMonitorInfo() {
        try {
            SystemInfo systemInfo = new SystemInfo();
            HardwareAbstractionLayer hardware = systemInfo.getHardware();
            OperatingSystem operatingSystem = systemInfo.getOperatingSystem();

            ServerMonitorVo vo = new ServerMonitorVo();
            vo.setCpu(buildCpu(hardware.getProcessor()));
            vo.setMem(buildMem(hardware.getMemory()));
            vo.setJvm(buildJvm());
            vo.setSys(buildSys());
            vo.setSysFiles(buildSysFiles(operatingSystem));
            return vo;
        } catch (Exception e) {
            log.error("server monitor collection failed", e);
            throw new ServiceException("server monitor collection failed: {}", e.getMessage());
        }
    }

    private ServerMonitorVo.Cpu buildCpu(CentralProcessor processor) {
        long[] previousTicks = processor.getSystemCpuLoadTicks();
        Util.sleep(CPU_SAMPLE_DELAY_MS);
        long[] ticks = processor.getSystemCpuLoadTicks();
        long nice = diff(ticks, previousTicks, TickType.NICE);
        long irq = diff(ticks, previousTicks, TickType.IRQ);
        long softIrq = diff(ticks, previousTicks, TickType.SOFTIRQ);
        long steal = diff(ticks, previousTicks, TickType.STEAL);
        long system = diff(ticks, previousTicks, TickType.SYSTEM);
        long user = diff(ticks, previousTicks, TickType.USER);
        long ioWait = diff(ticks, previousTicks, TickType.IOWAIT);
        long idle = diff(ticks, previousTicks, TickType.IDLE);
        long total = user + nice + system + idle + ioWait + irq + softIrq + steal;

        ServerMonitorVo.Cpu cpu = new ServerMonitorVo.Cpu();
        cpu.setCpuNum(processor.getLogicalProcessorCount());
        cpu.setUsed(percent(user + nice, total));
        cpu.setSys(percent(system + irq + softIrq, total));
        cpu.setWait(percent(ioWait, total));
        cpu.setFree(percent(idle, total));
        return cpu;
    }

    private ServerMonitorVo.Mem buildMem(GlobalMemory memory) {
        long total = memory.getTotal();
        long free = memory.getAvailable();
        long used = total - free;

        ServerMonitorVo.Mem mem = new ServerMonitorVo.Mem();
        mem.setTotal(toGb(total));
        mem.setUsed(toGb(used));
        mem.setFree(toGb(free));
        mem.setUsage(percent(used, total));
        return mem;
    }

    private ServerMonitorVo.Jvm buildJvm() {
        Runtime runtime = Runtime.getRuntime();
        RuntimeMXBean runtimeMxBean = ManagementFactory.getRuntimeMXBean();
        Properties properties = System.getProperties();
        Date startDate = DateUtils.getServerStartDate();

        double total = runtime.totalMemory();
        double free = runtime.freeMemory();

        ServerMonitorVo.Jvm jvm = new ServerMonitorVo.Jvm();
        jvm.setTotal(toMb(total));
        jvm.setMax(toMb(runtime.maxMemory()));
        jvm.setUsed(toMb(total - free));
        jvm.setFree(toMb(free));
        jvm.setUsage(percent(total - free, total));
        jvm.setName(runtimeMxBean.getVmName());
        jvm.setVersion(properties.getProperty("java.version"));
        jvm.setStartTime(DateUtils.formatDateTime(startDate));
        jvm.setRunTime(DateUtils.getTimeDifference(DateUtils.getNowDate(), startDate));
        return jvm;
    }

    private ServerMonitorVo.Sys buildSys() {
        Properties properties = System.getProperties();

        ServerMonitorVo.Sys sys = new ServerMonitorVo.Sys();
        sys.setOsName(properties.getProperty("os.name"));
        sys.setOsArch(properties.getProperty("os.arch"));
        return sys;
    }

    private List<ServerMonitorVo.SysFile> buildSysFiles(OperatingSystem operatingSystem) {
        FileSystem fileSystem = operatingSystem.getFileSystem();
        return fileSystem.getFileStores().stream()
            .map(this::buildSysFile)
            .toList();
    }

    private ServerMonitorVo.SysFile buildSysFile(OSFileStore fileStore) {
        long total = fileStore.getTotalSpace();
        long free = fileStore.getUsableSpace();
        long used = total - free;

        ServerMonitorVo.SysFile sysFile = new ServerMonitorVo.SysFile();
        sysFile.setDirName(fileStore.getMount());
        sysFile.setSysTypeName(fileStore.getType());
        sysFile.setTypeName(fileStore.getName());
        sysFile.setTotal(formatFileSize(total));
        sysFile.setFree(formatFileSize(free));
        sysFile.setUsed(formatFileSize(used));
        sysFile.setUsage(percent(used, total));
        return sysFile;
    }

    private long diff(long[] current, long[] previous, TickType tickType) {
        return current[tickType.getIndex()] - previous[tickType.getIndex()];
    }

    private double percent(double numerator, double denominator) {
        if (denominator <= 0) {
            return 0D;
        }
        return scale(numerator * 100D / denominator, 2);
    }

    private double toGb(double bytes) {
        return scale(bytes / 1024D / 1024D / 1024D, 2);
    }

    private double toMb(double bytes) {
        return scale(bytes / 1024D / 1024D, 2);
    }

    private double scale(double value, int scale) {
        return java.math.BigDecimal.valueOf(value)
            .setScale(scale, java.math.RoundingMode.HALF_UP)
            .doubleValue();
    }

    private String formatFileSize(long size) {
        long kb = 1024L;
        long mb = kb * 1024L;
        long gb = mb * 1024L;
        if (size >= gb) {
            return String.format("%.1f GB", (double) size / gb);
        }
        if (size >= mb) {
            double value = (double) size / mb;
            return String.format(value > 100 ? "%.0f MB" : "%.1f MB", value);
        }
        if (size >= kb) {
            double value = (double) size / kb;
            return String.format(value > 100 ? "%.0f KB" : "%.1f KB", value);
        }
        return size + " B";
    }
}
