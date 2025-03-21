export function getCookieValue(cookieName: string): string | undefined {
  const allCookies = document.cookie.split("; ");

  for (const cookie of allCookies) {
    const [name, ...rest] = cookie.split("=");
    if (name === cookieName) {
      return decodeURIComponent(rest.join("="));
    }
  }

  return undefined;
}

export function getCsrfToken(): string | undefined {
  return getCookieValue("XSRF-TOKEN");
}
