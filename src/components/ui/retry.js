export const RETRY_LIMIT = 3;

export function retryDelay(attempt, baseDelay = 2000) {
  return baseDelay * 2 ** Math.max(0, attempt);
}

export function shouldRetryStatus(status) {
  return status === 202 || status === 408 || status === 429 || status >= 500;
}

const wait = (ms, signal) => new Promise((resolve, reject) => {
  if (signal?.aborted) {
    reject(new DOMException('Aborted', 'AbortError'));
    return;
  }
  const timer = setTimeout(resolve, ms);
  signal?.addEventListener('abort', () => {
    clearTimeout(timer);
    reject(new DOMException('Aborted', 'AbortError'));
  }, { once: true });
});

export async function fetchWithRetry(url, { attempts = RETRY_LIMIT, baseDelay = 2000, signal, init = {} } = {}) {
  let lastError = null;
  for (let attempt = 0; attempt <= attempts; attempt += 1) {
    if (attempt > 0) await wait(retryDelay(attempt - 1, baseDelay), signal);
    const requestUrl = attempt > 0 ? `${url}${url.includes('?') ? '&' : '?'}imageRetry=${attempt}` : url;
    let response;
    try {
      response = await fetch(requestUrl, { ...init, signal });
    } catch (error) {
      if (error?.name === 'AbortError') throw error;
      lastError = error;
      continue;
    }
    if (response.ok && response.status !== 202) return response;
    lastError = new Error(`Request failed (${response.status})`);
    lastError.status = response.status;
    if (!shouldRetryStatus(response.status)) break;
  }
  throw lastError || new Error('Request failed');
}
