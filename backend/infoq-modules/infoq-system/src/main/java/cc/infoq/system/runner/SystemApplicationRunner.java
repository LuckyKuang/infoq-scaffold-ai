package cc.infoq.system.runner;

import cc.infoq.system.service.SysOssConfigService;
import lombok.AllArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

/**
 * 初始化 system 模块对应业务数据
 *
 * @author Pontus
 */
@Slf4j
@AllArgsConstructor
@Component
public class SystemApplicationRunner implements ApplicationRunner {

    private final SysOssConfigService ossConfigService;

    @Override
    public void run(ApplicationArguments args) throws Exception {
        ossConfigService.init();
        log.info("初始化OSS配置成功");
    }

}
