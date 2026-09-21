export function authHeaders(initData: string): HeadersInit {
  if (!initData) return {};
  return { "x-telegram-init-data": initData };
}

export async function apiGet<T>(path: string, initData = "") {
  const res = await fetch(path, {
    headers: authHeaders(initData),
    cache: "no-store",
  });
  const data = (await res.json()) as T & { error?: string };
  if (!res.ok) {
    throw new Error(data.error || "İstek başarısız.");
  }
  return data;
}

export async function apiPost<T>(path: string, body: unknown, initData = "") {
  const res = await fetch(path, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...authHeaders(initData),
    },
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as T & { error?: string };
  if (!res.ok) {
    throw new Error(data.error || "İstek başarısız.");
  }
  return data;
}
