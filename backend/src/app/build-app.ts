import Fastify from "fastify";
import rateLimit from "@fastify/rate-limit";
import { env } from "../config/env";
import { normalizeError } from "../lib/http";
import { healthRoutes } from "../modules/health/routes";
import { mapRoutes } from "../modules/maps/routes";

export async function buildApp() {
  const app = Fastify({
    logger: {
      level: env.logLevel,
    },
  });

  await app.register(rateLimit, {
    global: true,
    max: env.rateLimitMax,
    timeWindow: env.rateLimitWindow,
  });

  app.setErrorHandler((error, request, reply) => {
    const normalized = normalizeError(error);
    request.log.error({ err: error }, normalized.message);
    reply.status(normalized.statusCode).send({
      error: {
        code: normalized.code,
        message: normalized.message,
        details: normalized.details,
      },
    });
  });

  app.setNotFoundHandler((request, reply) => {
    reply.status(404).send({
      error: {
        code: "NOT_FOUND",
        message: `Fant ikke endepunkt: ${request.method} ${request.url}`,
      },
    });
  });

  await app.register(async (api) => {
    await api.register(healthRoutes);
    await api.register(mapRoutes);
  }, { prefix: env.apiBasePath });

  app.get(`${env.appBasePath}/healthz`, async () => ({
    status: "ok",
    service: "kommune-backend",
    timestamp: new Date().toISOString(),
  }));

  app.get(`${env.appBasePath}/readyz`, async () => ({
    status: "ready",
    service: "kommune-backend",
    timestamp: new Date().toISOString(),
  }));

  return app;
}
