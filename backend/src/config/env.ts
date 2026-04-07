import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  LOG_LEVEL: z.string().default("info"),
  DATABASE_URL: z.string().min(1),
  APP_BASE_PATH: z.string().default("/kommune"),
  API_BASE_PATH: z.string().default("/kommune/api"),
  RATE_LIMIT_MAX: z.coerce.number().positive().default(120),
  RATE_LIMIT_WINDOW: z.string().default("1 minute"),
  GEOCODER_ENABLED: z.coerce.boolean().default(true),
  GEOCODER_PROVIDER: z.string().default("osm"),
  GEOCODER_BASE_URL: z.string().url().default("https://nominatim.openstreetmap.org"),
  GEOCODER_USER_AGENT: z.string().default("kommune-mvp/1.0"),
  LEGAL_SOURCE_PROVIDER_ENABLED: z.coerce.boolean().default(true),
  PUBLIC_DATASET_PROVIDER_ENABLED: z.coerce.boolean().default(true),
  MUNICIPALITY_SOURCE_PROVIDER_ENABLED: z.coerce.boolean().default(true),
  TILE_URL_TEMPLATE: z.string().default("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"),
  TILE_ATTRIBUTION: z.string().default("Kartdata © OpenStreetMap-bidragsytere"),
  SEED_DEMO_DATA: z.coerce.boolean().default(false),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  throw new Error(`Ugyldig miljøkonfigurasjon: ${parsed.error.message}`);
}

function normalizeBasePath(rawPath: string) {
  if (rawPath === "/") {
    return "/";
  }

  const withLeadingSlash = rawPath.startsWith("/") ? rawPath : `/${rawPath}`;
  return withLeadingSlash.endsWith("/") ? withLeadingSlash.slice(0, -1) : withLeadingSlash;
}

export const env = {
  nodeEnv: parsed.data.NODE_ENV,
  logLevel: parsed.data.LOG_LEVEL,
  databaseUrl: parsed.data.DATABASE_URL,
  appBasePath: normalizeBasePath(parsed.data.APP_BASE_PATH),
  apiBasePath: normalizeBasePath(parsed.data.API_BASE_PATH),
  rateLimitMax: parsed.data.RATE_LIMIT_MAX,
  rateLimitWindow: parsed.data.RATE_LIMIT_WINDOW,
  geocoderEnabled: parsed.data.GEOCODER_ENABLED,
  geocoderProvider: parsed.data.GEOCODER_PROVIDER,
  geocoderBaseUrl: parsed.data.GEOCODER_BASE_URL,
  geocoderUserAgent: parsed.data.GEOCODER_USER_AGENT,
  legalSourceProviderEnabled: parsed.data.LEGAL_SOURCE_PROVIDER_ENABLED,
  publicDatasetProviderEnabled: parsed.data.PUBLIC_DATASET_PROVIDER_ENABLED,
  municipalitySourceProviderEnabled: parsed.data.MUNICIPALITY_SOURCE_PROVIDER_ENABLED,
  tileUrlTemplate: parsed.data.TILE_URL_TEMPLATE,
  tileAttribution: parsed.data.TILE_ATTRIBUTION,
  seedDemoData: parsed.data.SEED_DEMO_DATA,
};
