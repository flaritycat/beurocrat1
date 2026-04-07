import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { parseOrThrow, sendCreated } from "../../lib/http";
import { createCase, createCaseSchema, getCase, listCases, updateCase, updateCaseSchema, caseFiltersSchema } from "./service";

const paramsSchema = z.object({
  id: z.string().uuid(),
});

export const caseRoutes: FastifyPluginAsync = async (app) => {
  app.get("/cases", async (request) => {
    const query = parseOrThrow(caseFiltersSchema, request.query);
    return listCases(query);
  });

  app.post("/cases", async (request, reply) => {
    const payload = parseOrThrow(createCaseSchema, request.body);
    const created = await createCase(payload);
    return sendCreated(reply, created);
  });

  app.get("/cases/:id", async (request) => {
    const params = parseOrThrow(paramsSchema, request.params);
    return getCase(params.id);
  });

  app.patch("/cases/:id", async (request) => {
    const params = parseOrThrow(paramsSchema, request.params);
    const payload = parseOrThrow(updateCaseSchema, request.body);
    return updateCase(params.id, payload);
  });
};
