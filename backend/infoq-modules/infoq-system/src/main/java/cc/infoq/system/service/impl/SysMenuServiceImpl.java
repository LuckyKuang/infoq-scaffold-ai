package cc.infoq.system.service.impl;

import cc.infoq.common.constant.Constants;
import cc.infoq.common.constant.SystemConstants;
import cc.infoq.common.security.auth.LoginUserContext;
import cc.infoq.common.utils.MapstructUtils;
import cc.infoq.common.utils.StreamUtils;
import cc.infoq.common.utils.StringUtils;
import cc.infoq.common.utils.TreeBuildUtils;
import cc.infoq.system.domain.bo.SysMenuBo;
import cc.infoq.system.domain.entity.SysMenu;
import cc.infoq.system.domain.entity.SysRole;
import cc.infoq.system.domain.entity.SysRoleMenu;
import cc.infoq.system.domain.vo.MetaVo;
import cc.infoq.system.domain.vo.RouterVo;
import cc.infoq.system.domain.vo.SysMenuVo;
import cc.infoq.system.mapper.SysMenuMapper;
import cc.infoq.system.mapper.SysRoleMapper;
import cc.infoq.system.mapper.SysRoleMenuMapper;
import cc.infoq.system.service.SysMenuService;
import cn.hutool.core.collection.CollUtil;
import cn.hutool.core.lang.tree.Tree;
import cn.hutool.core.util.ObjectUtil;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import lombok.AllArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.LinkedList;
import java.util.List;
import java.util.Set;

/**
 * 菜单 业务层处理
 *
 * @author Pontus
 */
@Slf4j
@AllArgsConstructor
@Service
public class SysMenuServiceImpl implements SysMenuService {

    private final SysMenuMapper sysMenuMapper;
    private final SysRoleMapper sysRoleMapper;
    private final SysRoleMenuMapper sysRoleMenuMapper;

    /**
     * 根据用户查询系统菜单列表
     *
     * @param userId 用户ID
     * @return 菜单列表
     */
    @Override
    public List<SysMenuVo> selectMenuList(Long userId) {
        return selectMenuList(new SysMenuBo(), userId);
    }

    /**
     * 查询系统菜单列表
     *
     * @param menu 菜单信息
     * @return 菜单列表
     */
    @Override
    public List<SysMenuVo> selectMenuList(SysMenuBo menu, Long userId) {
        List<SysMenuVo> menuList;
        LambdaQueryWrapper<SysMenu> wrapper = new LambdaQueryWrapper<>();
        // 管理员显示所有菜单信息 不是管理员 按用户id过滤菜单
        if (!LoginUserContext.isSuperAdmin(userId)) {
            List<Long> menuIds = sysMenuMapper.selectMenuIdsByUserId(userId);
            if (CollUtil.isEmpty(menuIds)) {
                return List.of();
            }
            wrapper.in(SysMenu::getMenuId, menuIds);
        }
        menuList = sysMenuMapper.selectVoList(
            wrapper.like(StringUtils.isNotBlank(menu.getMenuName()), SysMenu::getMenuName, menu.getMenuName())
                .eq(StringUtils.isNotBlank(menu.getVisible()), SysMenu::getVisible, menu.getVisible())
                .eq(StringUtils.isNotBlank(menu.getStatus()), SysMenu::getStatus, menu.getStatus())
                .eq(StringUtils.isNotBlank(menu.getMenuType()), SysMenu::getMenuType, menu.getMenuType())
                .eq(ObjectUtil.isNotNull(menu.getParentId()), SysMenu::getParentId, menu.getParentId())
                .orderByAsc(SysMenu::getParentId)
                .orderByAsc(SysMenu::getOrderNum));
        return menuList;
    }

    /**
     * 根据用户ID查询权限
     *
     * @param userId 用户ID
     * @return 权限列表
     */
    @Override
    public Set<String> selectMenuPermsByUserId(Long userId) {
        return sysMenuMapper.selectMenuPermsByUserId(userId);
    }

    /**
     * 根据角色ID查询权限
     *
     * @param roleId 角色ID
     * @return 权限列表
     */
    @Override
    public Set<String> selectMenuPermsByRoleId(Long roleId) {
        return sysMenuMapper.selectMenuPermsByRoleId(roleId);
    }

    /**
     * 根据用户ID查询菜单
     *
     * @param userId 用户名称
     * @return 菜单列表
     */
    @Override
    public List<SysMenu> selectMenuTreeByUserId(Long userId) {
        List<SysMenu> menus;
        if (LoginUserContext.isSuperAdmin(userId)) {
            menus = sysMenuMapper.selectMenuTreeAll();
        } else {
            List<Long> menuIds = sysMenuMapper.selectMenuIdsByUserId(userId);
            if (CollUtil.isEmpty(menuIds)) {
                return List.of();
            }
            LambdaQueryWrapper<SysMenu> wrapper = new LambdaQueryWrapper<>();
            menus = sysMenuMapper.selectList(
                wrapper.in(SysMenu::getMenuType, SystemConstants.TYPE_DIR, SystemConstants.TYPE_MENU)
                    .eq(SysMenu::getStatus, SystemConstants.NORMAL)
                    .in(SysMenu::getMenuId, menuIds)
                    .orderByAsc(SysMenu::getParentId)
                    .orderByAsc(SysMenu::getOrderNum));
        }
        return getChildPerms(menus, Constants.TOP_PARENT_ID);
    }

    /**
     * 根据角色ID查询菜单树信息
     *
     * @param roleId 角色ID
     * @return 选中菜单列表
     */
    @Override
    public List<Long> selectMenuListByRoleId(Long roleId) {
        SysRole role = sysRoleMapper.selectById(roleId);
        return sysMenuMapper.selectMenuListByRoleId(roleId, role.getMenuCheckStrictly());
    }

    /**
     * 构建前端路由所需要的菜单
     * 路由name命名规则 path首字母转大写 + id
     *
     * @param menus 菜单列表
     * @return 路由列表
     */
    @Override
    public List<RouterVo> buildMenus(List<SysMenu> menus) {
        List<RouterVo> routers = new LinkedList<>();
        for (SysMenu menu : menus) {
            String name = menu.getRouteName() + menu.getMenuId();
            RouterVo router = new RouterVo();
            router.setHidden("1".equals(menu.getVisible()));
            router.setName(name);
            router.setPath(menu.getRouterPath());
            router.setComponent(menu.getComponentInfo());
            router.setQuery(menu.getQueryParam());
            router.setMeta(new MetaVo(menu.getMenuName(), menu.getIcon(), StringUtils.equals("1", menu.getIsCache()), menu.getPath(), menu.getRemark()));
            List<SysMenu> cMenus = menu.getChildren();
            if (CollUtil.isNotEmpty(cMenus) && SystemConstants.TYPE_DIR.equals(menu.getMenuType())) {
                router.setAlwaysShow(true);
                router.setRedirect("noRedirect");
                router.setChildren(buildMenus(cMenus));
            } else if (menu.isMenuFrame()) {
                String frameName = StringUtils.capitalize(menu.getPath()) + menu.getMenuId();
                router.setMeta(null);
                List<RouterVo> childrenList = new ArrayList<>();
                RouterVo children = new RouterVo();
                children.setPath(menu.getPath());
                children.setComponent(menu.getComponent());
                children.setName(frameName);
                children.setMeta(new MetaVo(menu.getMenuName(), menu.getIcon(), StringUtils.equals("1", menu.getIsCache()), menu.getPath(), menu.getRemark()));
                children.setQuery(menu.getQueryParam());
                childrenList.add(children);
                router.setChildren(childrenList);
            } else if (menu.getParentId().equals(Constants.TOP_PARENT_ID) && menu.isInnerLink()) {
                router.setMeta(new MetaVo(menu.getMenuName(), menu.getIcon()));
                router.setPath("/");
                List<RouterVo> childrenList = new ArrayList<>();
                RouterVo children = new RouterVo();
                String routerPath = SysMenu.innerLinkReplaceEach(menu.getPath());
                String innerLinkName = StringUtils.capitalize(routerPath) + menu.getMenuId();
                children.setPath(routerPath);
                children.setComponent(SystemConstants.INNER_LINK);
                children.setName(innerLinkName);
                children.setMeta(new MetaVo(menu.getMenuName(), menu.getIcon(), menu.getPath()));
                childrenList.add(children);
                router.setChildren(childrenList);
            }
            routers.add(router);
        }
        return routers;
    }

    /**
     * 构建前端所需要下拉树结构
     *
     * @param menus 菜单列表
     * @return 下拉树结构列表
     */
    @Override
    public List<Tree<Long>> buildMenuTreeSelect(List<SysMenuVo> menus) {
        if (CollUtil.isEmpty(menus)) {
            return CollUtil.newArrayList();
        }
        return TreeBuildUtils.build(menus, (menu, tree) -> {
            Tree<Long> menuTree = tree.setId(menu.getMenuId())
                .setParentId(menu.getParentId())
                .setName(menu.getMenuName())
                .setWeight(menu.getOrderNum());
            menuTree.put("menuType", menu.getMenuType());
            menuTree.put("icon", menu.getIcon());
            menuTree.put("visible", menu.getVisible());
            menuTree.put("status", menu.getStatus());
        });
    }

    /**
     * 根据菜单ID查询信息
     *
     * @param menuId 菜单ID
     * @return 菜单信息
     */
    @Override
    public SysMenuVo selectMenuById(Long menuId) {
        return sysMenuMapper.selectVoById(menuId);
    }

    /**
     * 是否存在菜单子节点
     *
     * @param menuId 菜单ID
     * @return 结果
     */
    @Override
    public boolean hasChildByMenuId(Long menuId) {
        return sysMenuMapper.exists(new LambdaQueryWrapper<SysMenu>().eq(SysMenu::getParentId, menuId));
    }

    /**
     * 是否存在菜单子节点
     *
     * @param menuIds 菜单ID串
     * @return 结果
     */
    @Override
    public boolean hasChildByMenuId(List<Long> menuIds) {
        return sysMenuMapper.exists(new LambdaQueryWrapper<SysMenu>().in(SysMenu::getParentId, menuIds).notIn(SysMenu::getMenuId, menuIds));
    }

    /**
     * 查询菜单使用数量
     *
     * @param menuId 菜单ID
     * @return 结果
     */
    @Override
    public boolean checkMenuExistRole(Long menuId) {
        return sysRoleMenuMapper.exists(new LambdaQueryWrapper<SysRoleMenu>().eq(SysRoleMenu::getMenuId, menuId));
    }

    /**
     * 新增保存菜单信息
     *
     * @param bo 菜单信息
     * @return 结果
     */
    @Override
    public int insertMenu(SysMenuBo bo) {
        SysMenu menu = MapstructUtils.convert(bo, SysMenu.class);
        return sysMenuMapper.insert(menu);
    }

    /**
     * 修改保存菜单信息
     *
     * @param bo 菜单信息
     * @return 结果
     */
    @Override
    public int updateMenu(SysMenuBo bo) {
        SysMenu menu = MapstructUtils.convert(bo, SysMenu.class);
        return sysMenuMapper.updateById(menu);
    }

    /**
     * 删除菜单管理信息
     *
     * @param menuId 菜单ID
     * @return 结果
     */
    @Override
    public int deleteMenuById(Long menuId) {
        return sysMenuMapper.deleteById(menuId);
    }

    /**
     * 批量删除菜单管理信息
     *
     * @param menuIds 菜单ID串
     * @return 结果
     */
    @Override
    @Transactional(rollbackFor = Exception.class)
    public void deleteMenuById(List<Long> menuIds) {
        sysMenuMapper.deleteByIds(menuIds);
        sysRoleMenuMapper.deleteByMenuIds(menuIds);
    }

    /**
     * 校验菜单名称是否唯一
     *
     * @param menu 菜单信息
     * @return 结果
     */
    @Override
    public boolean checkMenuNameUnique(SysMenuBo menu) {
        boolean exist = sysMenuMapper.exists(new LambdaQueryWrapper<SysMenu>()
            .eq(SysMenu::getMenuName, menu.getMenuName())
            .eq(SysMenu::getParentId, menu.getParentId())
            .ne(ObjectUtil.isNotNull(menu.getMenuId()), SysMenu::getMenuId, menu.getMenuId()));
        return !exist;
    }

    /**
     * 校验路由名称是否唯一
     *
     * @param menuBo 菜单信息
     * @return 结果
     */
    @Override
    public boolean checkRouteConfigUnique(SysMenuBo menuBo) {
        String menuType = menuBo.getMenuType();
        Long parentId = menuBo.getParentId();
        String path = menuBo.getPath();
        if (ObjectUtil.isNull(menuType) || ObjectUtil.isNull(parentId) || StringUtils.isBlank(path)) {
            log.warn("[路由配置校验失败] 菜单基础信息缺失 menuId={}, parentId={}, path={}, menuType={}",
                menuBo.getMenuId(), parentId, path, menuType);
            return false;
        }
        if (SystemConstants.TYPE_BUTTON.equals(menuType)) {
            return true;
        }
        long menuId = ObjectUtil.isNull(menuBo.getMenuId()) ? -1L : menuBo.getMenuId();
        SysMenu menu = new SysMenu();
        menu.setParentId(parentId);
        menu.setPath(path);
        menu.setMenuType(menuType);
        menu.setIsFrame(menuBo.getIsFrame());
        String derivedRouteName = StringUtils.isNotEmpty(menu.getIsFrame()) ? menu.getRouteName() : StringUtils.EMPTY;
        String routeName = StringUtils.isEmpty(derivedRouteName) ? path : derivedRouteName;
        List<SysMenu> sysMenuList = sysMenuMapper.selectList(
            new LambdaQueryWrapper<SysMenu>()
                .in(SysMenu::getMenuType, SystemConstants.TYPE_DIR, SystemConstants.TYPE_MENU)
                .and(wrapper -> wrapper
                    .eq(SysMenu::getPath, path)
                    .or()
                    .eq(SysMenu::getPath, routeName)));
        for (SysMenu sysMenu : sysMenuList) {
            if (sysMenu.getMenuId() != menuId) {
                Long dbParentId = sysMenu.getParentId();
                String dbPath = sysMenu.getPath();
                String dbRouteName = StringUtils.isEmpty(sysMenu.getRouteName()) ? dbPath : sysMenu.getRouteName();
                if (StringUtils.equalsAnyIgnoreCase(path, dbPath) && parentId.longValue() == dbParentId.longValue()) {
                    log.warn("[同级路由冲突] 同级下已存在相同路由路径 '{}'，冲突菜单：{}", dbPath, sysMenu.getMenuName());
                    return false;
                } else if (StringUtils.equalsAnyIgnoreCase(path, dbPath)
                    && parentId.longValue() == Constants.TOP_PARENT_ID
                    && dbParentId.longValue() == Constants.TOP_PARENT_ID) {
                    log.warn("[根目录路由冲突] 根目录下路由 '{}' 必须唯一，已被菜单 '{}' 占用", path, sysMenu.getMenuName());
                    return false;
                } else if (StringUtils.equalsAnyIgnoreCase(routeName, dbRouteName)) {
                    log.warn("[路由名称冲突] 路由名称 '{}' 需全局唯一，已被菜单 '{}' 使用", routeName, sysMenu.getMenuName());
                    return false;
                }
            }
        }
        return true;
    }

    /**
     * 根据父节点的ID获取所有子节点
     *
     * @param list     分类表
     * @param parentId 传入的父节点ID
     * @return String
     */
    private List<SysMenu> getChildPerms(List<SysMenu> list, Long parentId) {
        List<SysMenu> returnList = new ArrayList<>();
        for (SysMenu t : list) {
            // 一、根据传入的某个父节点ID,遍历该父节点的所有子节点
            if (t.getParentId().equals(parentId)) {
                recursionFn(list, t);
                returnList.add(t);
            }
        }
        return returnList;
    }

    /**
     * 递归列表
     */
    private void recursionFn(List<SysMenu> list, SysMenu t) {
        // 得到子节点列表
        List<SysMenu> childList = StreamUtils.filter(list, n -> n.getParentId().equals(t.getMenuId()));
        t.setChildren(childList);
        for (SysMenu tChild : childList) {
            // 判断是否有子节点
            if (list.stream().anyMatch(n -> n.getParentId().equals(tChild.getMenuId()))) {
                recursionFn(list, tChild);
            }
        }
    }

}
