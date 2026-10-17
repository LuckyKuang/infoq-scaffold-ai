package cc.infoq.common.utils.reflect;

import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;

@Tag("dev")
class ReflectUtilsTest {

    @Test
    void invokeGetterShouldResolveNestedProperty() {
        Profile profile = new Profile();
        profile.getUser().setNickname("alice");

        String nickname = ReflectUtils.invokeGetter(profile, "user.nickname");

        assertEquals("alice", nickname);
    }

    @Test
    void invokeSetterShouldSetNestedAndDirectProperty() {
        Profile profile = new Profile();

        ReflectUtils.invokeSetter(profile, "user.nickname", "bob");
        ReflectUtils.invokeSetter(profile, "displayName", "Bob Name");

        assertEquals("bob", profile.getUser().getNickname());
        assertEquals("Bob Name", profile.getDisplayName());
    }

    static class Profile {
        private final User user = new User();
        private String displayName;

        public User getUser() {
            return user;
        }

        public String getDisplayName() {
            return displayName;
        }

        public void setDisplayName(String displayName) {
            this.displayName = displayName;
        }
    }

    static class User {
        private String nickname;

        public String getNickname() {
            return nickname;
        }

        public void setNickname(String nickname) {
            this.nickname = nickname;
        }
    }
}
