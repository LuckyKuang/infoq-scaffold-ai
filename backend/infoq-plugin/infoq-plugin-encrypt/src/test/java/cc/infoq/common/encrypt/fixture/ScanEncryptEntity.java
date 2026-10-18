package cc.infoq.common.encrypt.fixture;

import cc.infoq.common.encrypt.annotation.EncryptField;

public class ScanEncryptEntity {

    @EncryptField
    private String secret;

    private String plain;

    public String getSecret() {
        return secret;
    }

    public void setSecret(String secret) {
        this.secret = secret;
    }

    public String getPlain() {
        return plain;
    }

    public void setPlain(String plain) {
        this.plain = plain;
    }
}
