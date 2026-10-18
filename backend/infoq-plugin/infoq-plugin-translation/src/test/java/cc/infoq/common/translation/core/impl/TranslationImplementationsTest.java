package cc.infoq.common.translation.core.impl;

import cc.infoq.common.service.DeptService;
import cc.infoq.common.service.DictService;
import cc.infoq.common.service.OssService;
import cc.infoq.common.service.UserService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@Tag("dev")
class TranslationImplementationsTest {

    @Mock
    private DeptService deptService;
    @Mock
    private DictService dictService;
    @Mock
    private OssService ossService;
    @Mock
    private UserService userService;

    @Test
    @DisplayName("DeptNameTranslationImpl: should support String and Long keys")
    void deptNameTranslationShouldSupportStringAndLongKeys() {
        DeptNameTranslationImpl impl = new DeptNameTranslationImpl(deptService);
        when(deptService.selectDeptNameByIds("10,20")).thenReturn("研发部,测试部");
        when(deptService.selectDeptNameByIds("100")).thenReturn("总部");

        assertEquals("研发部,测试部", impl.translation("10,20", null));
        assertEquals("总部", impl.translation(100L, null));
        assertNull(impl.translation(true, null));
    }

    @Test
    @DisplayName("DictTypeTranslationImpl: should translate only when dict value and type are both present")
    void dictTypeTranslationShouldRespectDictTypeCondition() {
        DictTypeTranslationImpl impl = new DictTypeTranslationImpl(dictService);
        when(dictService.getDictLabel("sys_user_sex", "1")).thenReturn("女");

        assertEquals("女", impl.translation("1", "sys_user_sex"));
        assertNull(impl.translation("1", ""));
        assertNull(impl.translation(1L, "sys_user_sex"));
        verify(dictService).getDictLabel("sys_user_sex", "1");
    }

    @Test
    @DisplayName("NicknameTranslationImpl: should support Long and String keys")
    void nicknameTranslationShouldSupportLongAndStringKeys() {
        NicknameTranslationImpl impl = new NicknameTranslationImpl(userService);
        when(userService.selectNicknameByIds("1")).thenReturn("管理员");
        when(userService.selectNicknameByIds("1,2")).thenReturn("管理员,测试员");

        assertEquals("管理员", impl.translation(1L, null));
        assertEquals("管理员,测试员", impl.translation("1,2", null));
        assertNull(impl.translation(new Object(), null));
    }

    @Test
    @DisplayName("OssUrlTranslationImpl: should support String and Long keys")
    void ossUrlTranslationShouldSupportStringAndLongKeys() {
        OssUrlTranslationImpl impl = new OssUrlTranslationImpl(ossService);
        when(ossService.selectUrlByIds("5")).thenReturn("https://cdn/infoq/5.png");
        when(ossService.selectUrlByIds("5,6")).thenReturn("https://cdn/infoq/5.png,https://cdn/infoq/6.png");

        assertEquals("https://cdn/infoq/5.png", impl.translation(5L, null));
        assertEquals("https://cdn/infoq/5.png,https://cdn/infoq/6.png", impl.translation("5,6", null));
        assertNull(impl.translation(1.2d, null));
    }

    @Test
    @DisplayName("UserNameTranslationImpl: should convert key to Long and delegate")
    void userNameTranslationShouldConvertKeyAndDelegate() {
        UserNameTranslationImpl impl = new UserNameTranslationImpl(userService);
        when(userService.selectUserNameById(3L)).thenReturn("admin");

        assertEquals("admin", impl.translation("3", null));
        verify(userService).selectUserNameById(3L);
    }
}

