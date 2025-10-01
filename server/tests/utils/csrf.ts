import { Application } from "express";
import request from "supertest";
import TestAgent from "supertest/lib/agent";

export type HttpMethod = "get" | "post" | "put" | "delete";

/**
 * Parse cookies from supertest response.set-cookie array
 */
export function parseSetCookie(setCookie: string[] | undefined) {
  if (!setCookie) return {};
  return setCookie.reduce<Record<string, string>>((acc, cookie) => {
    // cookieStr example: "CSRF-TOKEN=eyJhb...; Path=/; HttpOnly; SameSite=Lax"
    const nameValuePair = cookie.split(";")[0]; // "name=value"
    const idx = nameValuePair!.indexOf("=");
    if (idx === -1) return acc;
    const name = nameValuePair!.slice(0, idx).trim();
    const value = nameValuePair!.slice(idx + 1).trim();
    acc[name] = value;
    return acc;
  }, {});
}

/**
 * Log in using the real login endpoint and return:
 *  - accessToken (from response body)
 *  - cookies object (map cookieName -> cookieValue)
 *  - fullCookieHeader string that can be passed to `.set('Cookie', fullCookieHeader)`
 */
export async function loginAndGetCsrf(
  app: Application,
  email: string,
  password: string,
) {
  const agent = request(app);
  const res = await agent
    .post("/api/auth/login")
    .send({ email, password })
    .expect(200);

  // response body contains the access token
  const accessToken = (res.body?.user?.token as string) ?? null;

  // parse Set-Cookie header entries
  const setCookie = res.headers["set-cookie"] as string[] | undefined;
  const cookies = parseSetCookie(setCookie);

  // build a Cookie header string: "XSRF-TOKEN=...; CSRF-TOKEN=...; refresh_token=..."
  const cookieHeader = Object.entries(cookies)
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");

  return { accessToken, cookies, cookieHeader };
}

/**
 * Example helper to perform an authenticated request with CSRF set
 */
export async function postWithCsrf(
  app: Application,
  path: string,
  accessToken: string | null,
  cookieHeader: string,
  csrfTokenValue: string,
  body: string | object | undefined,
) {
  const agent = request(app);
  const req = agent
    .post(path)
    .set("Cookie", cookieHeader)
    .set("x-csrf-token", csrfTokenValue)
    .send(body);

  if (accessToken) req.set("Authorization", `Bearer ${accessToken}`);
  return req;
}

export async function reqWithCsrf(
  app: Application,
  method: HttpMethod,
  path: string,
  accessToken: string | null,
  cookieHeader: string | undefined,
  csrfTokenValue: string | undefined,
  body?: string | object,
) {
  if (!method) method = "post";
  const agent = request(app) as TestAgent;

  // ensure lowercase method
  const m = method.toLowerCase() as HttpMethod;

  // defensive: ensure agent supports the method
  if (typeof agent[m] !== "function") {
    throw new Error(`Unsupported HTTP method: ${method}`);
  }

  // create request builder dynamically
  const reqBuilder = agent[m](path);

  if (cookieHeader) {
    reqBuilder.set("Cookie", cookieHeader);
  }

  if (csrfTokenValue) {
    reqBuilder.set("x-csrf-token", csrfTokenValue);
  }

  if (accessToken) {
    reqBuilder.set("Authorization", `Bearer ${accessToken}`);
  }

  if (typeof body !== "undefined") {
    reqBuilder.send(body);
  }

  return await reqBuilder;
}
