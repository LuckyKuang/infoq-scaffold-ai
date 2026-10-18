package cc.infoq.common.encrypt.core.encryptor;

import cc.infoq.common.encrypt.core.EncryptContext;
import cc.infoq.common.encrypt.enumd.AlgorithmType;
import cc.infoq.common.encrypt.enumd.EncodeType;
import cc.infoq.common.encrypt.utils.EncryptUtils;
import cc.infoq.common.utils.StringUtils;

/**
 * sm2算法实现
 *
 * @author Pontus
 */
public class Sm2Encryptor extends AbstractEncryptor {

    private final EncryptContext context;

    public Sm2Encryptor(EncryptContext context) {
        super(context);
        String privateKey = context.getPrivateKey();
        String publicKey = context.getPublicKey();
        if (StringUtils.isAnyEmpty(privateKey, publicKey)) {
            throw new IllegalArgumentException("SM2公私钥均需要提供，公钥加密，私钥解密。");
        }
        this.context = context;
    }

    /**
     * 获得当前算法
     */
    @Override
    public AlgorithmType algorithm() {
        return AlgorithmType.SM2;
    }

    /**
     * 加密
     *
     * @param value      待加密字符串
     * @param encodeType 加密后的编码格式
     */
    @Override
    public String encrypt(String value, EncodeType encodeType) {
        if (encodeType == EncodeType.HEX) {
            return EncryptUtils.encryptBySm2Hex(value, context.getPublicKey());
        } else {
            return EncryptUtils.encryptBySm2(value, context.getPublicKey());
        }
    }

    /**
     * 解密
     *
     * @param value      待加密字符串
     */
    @Override
    public String decrypt(String value) {
        return EncryptUtils.decryptBySm2(value, context.getPrivateKey());
    }
}
