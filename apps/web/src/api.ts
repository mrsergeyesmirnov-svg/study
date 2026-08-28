import { getInitData } from "./telegram";

declare global {
  interface Window {
    __VTG_API__?: string;
  }
}

function apiBase(): string {
  const fromRuntime = window.__VTG_API__?.replace(/\/$/, "");
  const fromBuild = import.meta.env.VITE_API_URL?.replace(/\/$/, "");
  let base = fromRuntime || fromBuild || "/api";
  // VITE_API_URL = https://study... → нужен .../api/admin/me, не .../admin/me
  if (base.startsWith("http") && !base.endsWith("/api")) {
    base = `${base}/api`;
  }
  return base;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const API = apiBase();
  const headers = new Headers(options.headers);
  const initData = getInitData();
  if (initData) headers.set("X-Telegram-Init-Data", initData);
  if (!(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(`${API}${path}`, { ...options, headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || res.statusText);
  }
  return res.json() as Promise<T>;
}

export interface ProductItem {
  id: string;
  code: string | null;
  title: string;
  description: string | null;
  brand: string | null;
  size: string | null;
  conditionText: string | null;
  measurements: string | null;
  story: string | null;
  priceRub: number;
  status: string;
  images: string[];
  publicUrl: string | null;
  isAvailable: boolean;
}

export const api = {
  catalog: (params?: { size?: string; q?: string }) => {
    const q = new URLSearchParams();
    if (params?.size) q.set("size", params.size);
    if (params?.q) q.set("q", params.q);
    return request<{ items: ProductItem[] }>(`/public/catalog?${q}`);
  },
  sizes: () => request<{ sizes: string[] }>("/public/sizes"),
  item: (code: string) =>
    request<{ code: string; status: string; product: ProductItem | null; message?: string }>(
      `/public/item/${code}`,
    ),
  similar: (productId: string) =>
    request<{ items: ProductItem[] }>(`/public/similar/${productId}`),
  createOrder: (productIds: string[]) =>
    request<{ order: { id: string; totalRub: number }; paymentInfo: string }>("/orders", {
      method: "POST",
      body: JSON.stringify({ productIds }),
    }),
  adminMe: () =>
    request<{ authenticated: boolean; admin: boolean }>("/admin/me"),
  adminScan: (code: string) =>
    request<{ code: string; found: boolean; action: string; product?: ProductItem }>(
      `/admin/scan/${code}`,
    ),
  adminGenerateBarcodes: (count: number) =>
    request<{ batchId: string; codes: string[] }>("/admin/barcodes/generate", {
      method: "POST",
      body: JSON.stringify({ count }),
    }),
  adminPoolBarcodes: () =>
    request<{ items: { code: string; status: string }[] }>("/admin/barcodes?status=POOL&limit=500"),
  adminCreateProduct: (data: Record<string, unknown>) =>
    request<{ product: ProductItem; code: string }>("/admin/products", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  adminMarkSold: (code: string) =>
    request<{ ok: boolean }>(`/admin/scan/${code}/sold`, { method: "POST" }),
  uploadImage: (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    return request<{ url: string }>("/upload", { method: "POST", body: fd });
  },
};

export function formatPrice(n: number) {
  return `${n.toLocaleString("ru-RU")} ₽`;
}
