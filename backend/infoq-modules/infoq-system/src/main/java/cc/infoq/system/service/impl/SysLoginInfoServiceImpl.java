package cc.infoq.system.service.impl;

import cc.infoq.common.constant.Constants;
import cc.infoq.common.log.event.LoginInfoEvent;
import cc.infoq.common.mybatis.core.page.PageQuery;
import cc.infoq.common.mybatis.core.page.TableDataInfo;
import cc.infoq.common.security.auth.SecurityAuthNames;
import cc.infoq.common.utils.MapstructUtils;
import cc.infoq.common.utils.ServletUtils;
import cc.infoq.common.utils.StringUtils;
import cc.infoq.common.utils.ip.AddressUtils;
import cc.infoq.system.domain.bo.SysLoginInfoBo;
import cc.infoq.system.domain.entity.SysLoginInfo;
import cc.infoq.system.domain.vo.SysClientVo;
import cc.infoq.system.domain.vo.SysLoginInfoVo;
import cc.infoq.system.mapper.SysLoginInfoMapper;
import cc.infoq.system.service.SysClientService;
import cc.infoq.system.service.SysLoginInfoService;
import cn.hutool.core.util.ObjectUtil;
import cn.hutool.http.useragent.UserAgent;
import cn.hutool.http.useragent.UserAgentUtil;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import jakarta.servlet.http.HttpServletRequest;
import lombok.AllArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.util.Arrays;
import java.util.Date;
import java.util.List;
import java.util.Map;

/**
 * 系统访问日志情况信息 服务层处理
 *
 * @author Pontus
 */
@AllArgsConstructor
@Slf4j
@Service
public class SysLoginInfoServiceImpl implements SysLoginInfoService {

    private static final String CLIENT_KEY_HEADER = "x-client-key";
    private static final String DEVICE_TYPE_HEADER = "x-device-type";

    private final SysLoginInfoMapper sysLoginInfoMapper;

    private final SysClientService sysClientService;

    /**
     * 记录登录信息
     *
     * @param loginInfoEvent 登录事件
     */
    @Async
    @EventListener
    public void recordLoginInfo(LoginInfoEvent loginInfoEvent) {
        HttpServletRequest request = loginInfoEvent.getRequest();
        final UserAgent userAgent = request != null ? UserAgentUtil.parse(request.getHeader("User-Agent")) : null;
        final String ip = request != null ? ServletUtils.getClientIP(request) : StringUtils.EMPTY;
        // 客户端信息
        String clientId = request != null ? request.getHeader(SecurityAuthNames.CLIENT_ID) : StringUtils.EMPTY;
        String runtimeClientKey = request != null ? request.getHeader(CLIENT_KEY_HEADER) : StringUtils.EMPTY;
        String runtimeDeviceType = request != null ? request.getHeader(DEVICE_TYPE_HEADER) : StringUtils.EMPTY;
        SysClientVo client = null;
        if (StringUtils.isNotBlank(clientId)) {
            client = sysClientService.queryByClientId(clientId);
        }

        String address = AddressUtils.getRealAddressByIP(ip);
        StringBuilder sb = new StringBuilder();
        sb.append(getBlock(ip));
        sb.append(address);
        sb.append(getBlock(loginInfoEvent.getUsername()));
        sb.append(getBlock(loginInfoEvent.getStatus()));
        sb.append(getBlock(loginInfoEvent.getMessage()));
        // 打印信息到日志
        log.info(sb.toString(), loginInfoEvent.getArgs());
        // 获取客户端操作系统
        String os = userAgent != null && userAgent.getOs() != null ? userAgent.getOs().getName() : StringUtils.EMPTY;
        // 获取客户端浏览器
        String browser = userAgent != null && userAgent.getBrowser() != null ? userAgent.getBrowser().getName() : StringUtils.EMPTY;
        // 封装对象
        SysLoginInfoBo loginInfo = new SysLoginInfoBo();
        loginInfo.setUserName(loginInfoEvent.getUsername());
        if (ObjectUtil.isNotNull(client)) {
            loginInfo.setClientKey(StringUtils.blankToDefault(runtimeClientKey, client.getClientKey()));
            loginInfo.setDeviceType(StringUtils.blankToDefault(runtimeDeviceType, client.getDeviceType()));
        } else {
            loginInfo.setClientKey(StringUtils.blankToDefault(runtimeClientKey, null));
            loginInfo.setDeviceType(StringUtils.blankToDefault(runtimeDeviceType, null));
        }
        loginInfo.setIpaddr(ip);
        loginInfo.setLoginLocation(address);
        loginInfo.setBrowser(browser);
        loginInfo.setOs(os);
        loginInfo.setMsg(loginInfoEvent.getMessage());
        // 日志状态
        if (StringUtils.equalsAny(loginInfoEvent.getStatus(), Constants.LOGIN_SUCCESS, Constants.LOGOUT, Constants.REGISTER)) {
            loginInfo.setStatus(Constants.SUCCESS);
        } else if (Constants.LOGIN_FAIL.equals(loginInfoEvent.getStatus())) {
            loginInfo.setStatus(Constants.FAIL);
        }
        // 插入数据
        insertLoginInfo(loginInfo);
    }

    private String getBlock(Object msg) {
        if (msg == null) {
            msg = "";
        }
        return "[" + msg.toString() + "]";
    }

    /**
     * 分页查询登录日志列表
     *
     * @param loginInfo 查询条件
     * @param pageQuery  分页参数
     * @return 登录日志分页列表
     */
    @Override
    public TableDataInfo<SysLoginInfoVo> selectPageLoginInfoList(SysLoginInfoBo loginInfo, PageQuery pageQuery) {
        Map<String, Object> params = loginInfo.getParams();
        LambdaQueryWrapper<SysLoginInfo> lqw = new LambdaQueryWrapper<SysLoginInfo>()
            .like(StringUtils.isNotBlank(loginInfo.getIpaddr()), SysLoginInfo::getIpaddr, loginInfo.getIpaddr())
            .eq(StringUtils.isNotBlank(loginInfo.getStatus()), SysLoginInfo::getStatus, loginInfo.getStatus())
            .like(StringUtils.isNotBlank(loginInfo.getUserName()), SysLoginInfo::getUserName, loginInfo.getUserName())
            .between(params.get("beginTime") != null && params.get("endTime") != null,
                SysLoginInfo::getLoginTime, params.get("beginTime"), params.get("endTime"));
        if (StringUtils.isBlank(pageQuery.getOrderByColumn())) {
            lqw.orderByDesc(SysLoginInfo::getInfoId);
        }
        Page<SysLoginInfoVo> page = sysLoginInfoMapper.selectVoPage(pageQuery.build(), lqw);
        return TableDataInfo.build(page);
    }

    /**
     * 新增系统登录日志
     *
     * @param bo 访问日志对象
     */
    @Override
    public void insertLoginInfo(SysLoginInfoBo bo) {
        SysLoginInfo loginInfo = MapstructUtils.convert(bo, SysLoginInfo.class);
        loginInfo.setLoginTime(new Date());
        sysLoginInfoMapper.insert(loginInfo);
    }

    /**
     * 查询系统登录日志集合
     *
     * @param loginInfo 访问日志对象
     * @return 登录记录集合
     */
    @Override
    public List<SysLoginInfoVo> selectLoginInfoList(SysLoginInfoBo loginInfo) {
        Map<String, Object> params = loginInfo.getParams();
        return sysLoginInfoMapper.selectVoList(new LambdaQueryWrapper<SysLoginInfo>()
            .like(StringUtils.isNotBlank(loginInfo.getIpaddr()), SysLoginInfo::getIpaddr, loginInfo.getIpaddr())
            .eq(StringUtils.isNotBlank(loginInfo.getStatus()), SysLoginInfo::getStatus, loginInfo.getStatus())
            .like(StringUtils.isNotBlank(loginInfo.getUserName()), SysLoginInfo::getUserName, loginInfo.getUserName())
            .between(params.get("beginTime") != null && params.get("endTime") != null,
                SysLoginInfo::getLoginTime, params.get("beginTime"), params.get("endTime"))
            .orderByDesc(SysLoginInfo::getInfoId));
    }

    /**
     * 批量删除系统登录日志
     *
     * @param infoIds 需要删除的登录日志ID
     * @return 结果
     */
    @Override
    public int deleteLoginInfoByIds(Long[] infoIds) {
        return sysLoginInfoMapper.deleteByIds(Arrays.asList(infoIds));
    }

    /**
     * 清空系统登录日志
     */
    @Override
    public void cleanLoginInfo() {
        sysLoginInfoMapper.delete(new LambdaQueryWrapper<>());
    }
}
