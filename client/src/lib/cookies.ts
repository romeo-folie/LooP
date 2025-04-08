export function getCookieValue(cookieName: string): string | null {
  const allCookies = document.cookie.split("; ");

  for (const cookie of allCookies) {
    const [name, ...rest] = cookie.split("=");
    if (name === cookieName) {
      return decodeURIComponent(rest.join("="));
    }
  }

  return null;
}

export function getCsrfToken(): string | null {
  return getCookieValue("XSRF-TOKEN");
}
