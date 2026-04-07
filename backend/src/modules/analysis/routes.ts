import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { parseOrThrow } from "../../lib/http";
import { analyzeCase, getAnalysis } from "./service";

const paramsSchema = z.object({
  id: z.string().uuid(),
});

export const analysisRoutes: FastifyPluginAsync = async (app) => {
  app.post("/cases/:id/analyze", async (request) => {
    const params = parseOrThrow(paramsSchema, request.params);
    return analyzeCase(params.id);
  });

  app.get("/cases/:id/analysis", async (request) => {
    const params = parseOrThrow(paramsSchema, request.params);
    return getAnalysis(params.id);
  });
};
