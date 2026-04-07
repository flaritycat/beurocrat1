import type { FastifyPluginAsync } from "fastify";
import { pool } from "../../db/pool";

export const healthRoutes: FastifyPluginAsync = async (app) => {
  app.get("/healthz", async () => {
    return {
      status: "ok",
      service: "kommune-backend",
      timestamp: new Date().toISOString(),
    };
  });

  app.get("/readyz", async (_request, reply) => {
    await pool.query("SELECT 1");
    return reply.send({
      status: "ready",
      database: "ok",
      timestamp: new Date().toISOString(),
    });
  });
};
