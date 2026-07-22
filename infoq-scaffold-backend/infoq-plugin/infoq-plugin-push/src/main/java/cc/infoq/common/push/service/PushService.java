package cc.infoq.common.push.service;

import cc.infoq.common.push.domain.PushRequest;
import cc.infoq.common.push.domain.PushResult;

public interface PushService {

    PushResult push(PushRequest request);
}
