export function authHeaders(initData: string): HeadersInit {
  if (!initData) return {};
  return { "x-telegram-init-data": initData };
}

async function parseJson<T>(res: Response) {
  const data = (await res.json()) as T & { error?: string };
  if (!res.ok) {
    throw new Error(data.error || "İstek başarısız.");
  }
  return data;
}

function timedFetch(path: string, init: RequestInit, ms = 12_000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return fetch(path, { ...init, signal: controller.signal }).finally(() =>
    clearTimeout(timer),
  );
}

export async function apiGet<T>(path: string, initData = "") {
  const res = await timedFetch(path, {
    headers: authHeaders(initData),
    cache: "no-store",
  });
  return parseJson<T>(res);
}

export async function apiPost<T>(path: string, body: unknown, initData = "") {
  const res = await timedFetch(path, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...authHeaders(initData),
    },
    body: JSON.stringify(body),
  });
  return parseJson<T>(res);
}
