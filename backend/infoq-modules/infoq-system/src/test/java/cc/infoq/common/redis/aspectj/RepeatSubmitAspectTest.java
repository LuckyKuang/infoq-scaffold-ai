package cc.infoq.common.redis.aspectj;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.validation.BindingResult;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.mock;

@Tag("dev")
class RepeatSubmitAspectTest {

    private final RepeatSubmitAspect aspect = new RepeatSubmitAspect();

    @Test
    @DisplayName("isFilterObject: should return true for servlet and validation objects")
    void isFilterObjectShouldReturnTrueForServletObjects() {
        assertTrue(aspect.isFilterObject(mock(HttpServletRequest.class)));
        assertTrue(aspect.isFilterObject(mock(HttpServletResponse.class)));
        assertTrue(aspect.isFilterObject(mock(BindingResult.class)));
    }

    @Test
    @DisplayName("isFilterObject: should return true for multipart forms")
    void isFilterObjectShouldReturnTrueForMultipart() {
        MultipartFile file = mock(MultipartFile.class);

        assertTrue(aspect.isFilterObject(file));
        assertTrue(aspect.isFilterObject(new MultipartFile[]{file}));
        assertTrue(aspect.isFilterObject(List.of(file)));
        assertTrue(aspect.isFilterObject(Map.of("f", file)));
    }

    @Test
    @DisplayName("isFilterObject: should return false for normal payload")
    void isFilterObjectShouldReturnFalseForNormalPayload() {
        assertFalse(aspect.isFilterObject("plain-text"));
        assertFalse(aspect.isFilterObject(List.of("a", "b")));
    }
}
