package cc.infoq.system.controller.login;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertTrue;

@Tag("dev")
class IndexControllerTest {

    @Test
    @DisplayName("index: should return welcome message")
    void indexShouldReturnWelcomeMessage() {
        IndexController controller = new IndexController();

        String text = controller.index();

        assertTrue(text.contains("欢迎使用"));
        assertTrue(text.contains("后台管理框架"));
    }
}
