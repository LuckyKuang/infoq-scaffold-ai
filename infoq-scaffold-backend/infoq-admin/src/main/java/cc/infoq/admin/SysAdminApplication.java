package cc.infoq.admin;

import cn.hutool.crypto.digest.BCrypt;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

import java.io.IOException;
import java.nio.charset.StandardCharsets;

/**
 * 启动程序
 */
@Slf4j
@SpringBootApplication(scanBasePackages = "cc.infoq")
public class SysAdminApplication {

    private static final String BCRYPT_HASH_STDIN_ARG = "--infoq-bcrypt-hash-stdin";

    public static void main(String[] args) {
        if (args.length == 1 && BCRYPT_HASH_STDIN_ARG.equals(args[0])) {
            String password;
            try {
                password = new String(System.in.readAllBytes(), StandardCharsets.UTF_8)
                    .replaceFirst("\\R\\z", "");
            } catch (IOException e) {
                System.err.println("Failed to read password from stdin: " + e.getMessage());
                System.exit(1);
                return;
            }
            if (password.isBlank()) {
                System.err.println("Password input must not be blank");
                System.exit(1);
                return;
            }
            System.out.print(BCrypt.hashpw(password));
            return;
        }

        SpringApplication.run(SysAdminApplication.class, args);
        log.info("infoq-scaffold-backend started successfully");
    }
}
