export async function runTestLifecycle({report, execute, cleanup, stop, persist}) {
  const controller = new AbortController();
  const handlers = new Map(['SIGINT', 'SIGTERM', 'SIGHUP'].map((signal) => [signal, () => {
    if (!controller.signal.aborted) controller.abort(new Error(`Interrupted by ${signal}`));
    process.exitCode = signal === 'SIGINT' ? 130 : signal === 'SIGHUP' ? 129 : 143;
  }]));
  for (const [signal, handler] of handlers) process.on(signal, handler);
  let failure;
  report.cleanupErrors = [];
  try {
    await execute(controller.signal);
    controller.signal.throwIfAborted();
    report.status = 'passed';
  } catch (error) {
    failure = error;
    report.status = controller.signal.aborted ? 'interrupted' : 'failed';
    report.error = (controller.signal.aborted ? controller.signal.reason : error).message || String(error);
  } finally {
    try {
      await cleanup();
    } catch (error) {
      report.cleanupErrors.push(error.message || String(error));
      failure ||= error;
      if (report.status !== 'interrupted') report.status = 'failed';
    }
    if (controller.signal.aborted) {
      report.status = 'interrupted';
      report.error = controller.signal.reason.message;
      failure ||= controller.signal.reason;
    }
    let stoppedStatus;
    try {
      // 终态最多从 passed -> failed -> interrupted；落盘失败只做有界重试。
      for (let attempt = 0; attempt < 3; attempt += 1) {
        if (attempt === 0 || (stoppedStatus === 'passed' && report.status !== 'passed')) {
          const requestedStatus = report.status;
          try {
            await stop(requestedStatus);
            stoppedStatus = requestedStatus;
          } catch (error) {
            stoppedStatus = undefined;
            report.cleanupErrors.push(`Process cleanup: ${error.message || error}`);
            failure = failure ? new AggregateError([failure, error], `${failure.message}; Process cleanup: ${error.message || error}`) : error;
            if (report.status !== 'interrupted') report.status = 'failed';
          }
        }
        if (controller.signal.aborted) {
          report.status = 'interrupted';
          report.error ||= controller.signal.reason.message;
          failure ||= controller.signal.reason;
        }
        report.finishedAt = new Date().toISOString();
        if (failure && !report.error) report.error = failure.message || String(failure);
        const writtenStatus = report.status;
        let persistenceFailed = false;
        try {
          await persist();
        } catch (error) {
          persistenceFailed = true;
          report.cleanupErrors.push(`Report persistence: ${error.message || error}`);
          if (report.status !== 'interrupted') report.status = 'failed';
          report.error ||= error.message || String(error);
          failure = failure ? new AggregateError([failure, error], `${failure.message}; Report persistence: ${error.message || error}`) : error;
        }
        if (controller.signal.aborted) {
          report.status = 'interrupted';
          report.error ||= controller.signal.reason.message;
          failure ||= controller.signal.reason;
        }
        // keep-stack-after 仅对最终成功有效；落盘失败或晚到的信号须先撤销保留决定。
        const mustStopKeptStack = stoppedStatus === 'passed' && report.status !== 'passed';
        if (!mustStopKeptStack && report.status === writtenStatus && (!persistenceFailed || attempt > 0)) break;
      }
    } finally {
      for (const [signal, handler] of handlers) process.removeListener(signal, handler);
    }
  }
  if (failure) throw failure;
}
