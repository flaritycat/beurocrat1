function normalizeAppBasePath(rawPath: string) {
  if (!rawPath || rawPath === "/") {
    return "/";
  }

  const withLeadingSlash = rawPath.startsWith("/") ? rawPath : `/${rawPath}`;
  return withLeadingSlash.endsWith("/") ? withLeadingSlash.slice(0, -1) : withLeadingSlash;
}

export const appBasePath = normalizeAppBasePath(import.meta.env.VITE_APP_BASE_PATH || "/kommune/");
export const apiBasePath = normalizeAppBasePath(import.meta.env.VITE_API_BASE_PATH || "/kommune/api");
