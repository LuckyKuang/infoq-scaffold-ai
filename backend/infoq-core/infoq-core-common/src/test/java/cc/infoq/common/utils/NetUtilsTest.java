package cc.infoq.common.utils;

import cc.infoq.common.utils.ip.AddressUtils;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

@Tag("dev")
class NetUtilsTest {

    @Test
    @DisplayName("isInnerIPv6: should identify loopback and global addresses")
    void isInnerIPv6ShouldIdentifyLoopbackAndGlobalAddresses() {
        assertTrue(NetUtils.isInnerIPv6("::1"));
        assertFalse(NetUtils.isInnerIPv6("2001:db8::1"));
    }

    @Test
    @DisplayName("isInnerIPv6: should throw for invalid ipv6 text")
    void isInnerIPv6ShouldThrowForInvalidIpv6Text() {
        assertThrows(IllegalArgumentException.class, () -> NetUtils.isInnerIPv6("bad-ipv6"));
    }

    @Test
    @DisplayName("isIPv4/isIPv6: should identify valid and invalid addresses")
    void isIpv4AndIpv6ShouldWork() {
        assertTrue(NetUtils.isIPv4("127.0.0.1"));
        assertFalse(NetUtils.isIPv4("999.999.999.999"));
        assertTrue(NetUtils.isIPv6("2001:db8::1"));
        assertFalse(NetUtils.isIPv6("invalid-ip"));
    }

    @Test
    @DisplayName("getRealAddressByIP: should return unknown for invalid ip input")
    void getRealAddressByIpShouldReturnUnknownForInvalidInput() {
        assertEquals(AddressUtils.UNKNOWN_IP, AddressUtils.getRealAddressByIP("<b>bad-ip</b>"));
    }
}
