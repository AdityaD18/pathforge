"use client";

import { env } from "@/lib/env";
import { getSupabase } from "@/lib/supabase/client";

export class ApiError extends Error {
  constructor(public status: number, message: string, public detail?: unknown) {
    super(message);
  }
}

function messageFrom(detail: unknown, status: number): string {
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    // FastAPI validation errors
    return detail.map((d: { loc?: unknown[]; msg?: string }) => `${(d.loc ?? []).slice(1).join(".")}: ${d.msg}`).join("; ");
  }
  if (detail && typeof detail === "object" && "message" in detail) return String((detail as { message: unknown }).message);
  if (status === 401) return "Your session has expired. Sign in again.";
  if (status >= 500) return "The PathForge API is unavailable right now. Try again in a moment.";
  return `Request failed (${status})`;
}

/** Call the FastAPI backend with the current Supabase access token. */
export async function api<T>(path: string, init: RequestInit & { auth?: boolean } = {}): Promise<T> {
  const { auth = true, headers, ...rest } = init;
  const h = new Headers(headers);
  if (rest.body && !h.has("Content-Type")) h.set("Content-Type", "application/json");
  if (auth) {
    const { data } = await getSupabase().auth.getSession();
    const token = data.session?.access_token;
    if (!token) throw new ApiError(401, "Sign in to continue.");
    h.set("Authorization", `Bearer ${token}`);
  }

  let res: Response;
  try {
    res = await fetch(`${env.apiUrl}${path}`, { ...rest, headers: h });
  } catch {
    throw new ApiError(0, "Can't reach the PathForge API. Check your connection or the API URL.");
  }
  if (res.status === 204) return undefined as T;
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const detail = body?.detail;
    throw new ApiError(res.status, messageFrom(detail, res.status), detail);
  }
  return body as T;
}

export function qs(params: Record<string, string | number | string[] | undefined | null>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "") continue;
    if (Array.isArray(v)) v.forEach((x) => sp.append(k, x));
    else sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}
