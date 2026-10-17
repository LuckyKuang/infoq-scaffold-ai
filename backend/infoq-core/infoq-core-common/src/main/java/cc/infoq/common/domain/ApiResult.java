package cc.infoq.common.domain;

import cc.infoq.common.constant.HttpStatus;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.io.Serial;
import java.io.Serializable;

/**
 * 响应信息主体
 *
 * @author Pontus
 */
@Data
@NoArgsConstructor
public class ApiResult<T> implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    /**
     * 成功
     */
    public static final int SUCCESS = 200;

    /**
     * 失败
     */
    public static final int FAIL = 500;

    private int code;

    private String msg;

    private T data;

    public static <T> ApiResult<T> ok() {
        return restResult(null, SUCCESS, "操作成功");
    }

    public static <T> ApiResult<T> ok(T data) {
        return restResult(data, SUCCESS, "操作成功");
    }

    public static <T> ApiResult<T> ok(String msg) {
        return restResult(null, SUCCESS, msg);
    }

    public static <T> ApiResult<T> ok(String msg, T data) {
        return restResult(data, SUCCESS, msg);
    }

    public static <T> ApiResult<T> fail() {
        return restResult(null, FAIL, "操作失败");
    }

    public static <T> ApiResult<T> fail(String msg) {
        return restResult(null, FAIL, msg);
    }

    public static <T> ApiResult<T> fail(T data) {
        return restResult(data, FAIL, "操作失败");
    }

    public static <T> ApiResult<T> fail(String msg, T data) {
        return restResult(data, FAIL, msg);
    }

    public static <T> ApiResult<T> fail(int code, String msg) {
        return restResult(null, code, msg);
    }

    /**
     * 返回警告消息
     *
     * @param msg 返回内容
     * @return 警告消息
     */
    public static <T> ApiResult<T> warn(String msg) {
        return restResult(null, HttpStatus.WARN, msg);
    }

    /**
     * 返回警告消息
     *
     * @param msg 返回内容
     * @param data 数据对象
     * @return 警告消息
     */
    public static <T> ApiResult<T> warn(String msg, T data) {
        return restResult(data, HttpStatus.WARN, msg);
    }

    private static <T> ApiResult<T> restResult(T data, int code, String msg) {
        ApiResult<T> apiResult = new ApiResult<>();
        apiResult.setCode(code);
        apiResult.setData(data);
        apiResult.setMsg(msg);
        return apiResult;
    }

    public static <T> Boolean isError(ApiResult<T> ret) {
        return !isSuccess(ret);
    }

    public static <T> Boolean isSuccess(ApiResult<T> ret) {
        return ApiResult.SUCCESS == ret.getCode();
    }
}
