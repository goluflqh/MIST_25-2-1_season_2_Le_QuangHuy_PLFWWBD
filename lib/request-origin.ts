function firstHeaderValue(value: string | null) {
  return value?.split(",")[0]?.trim() || null;
}

export function hasSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return false;

  try {
    const requestUrl = new URL(request.url);
    const host = firstHeaderValue(request.headers.get("x-forwarded-host"))
      || firstHeaderValue(request.headers.get("host"))
      || requestUrl.host;
    const forwardedProto = firstHeaderValue(request.headers.get("x-forwarded-proto"));
    const protocol = forwardedProto ? `${forwardedProto.replace(/:$/, "")}:` : requestUrl.protocol;
    if (protocol !== "http:" && protocol !== "https:") return false;

    return new URL(origin).origin === new URL(`${protocol}//${host}`).origin;
  } catch {
    return false;
  }
}
