import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { parseOrThrow, sendCreated } from "../../lib/http";
import { createSource, createSourceSchema, listSources } from "./service";

const paramsSchema = z.object({
  id: z.string().uuid(),
});

export const sourceRoutes: FastifyPluginAsync = async (app) => {
  app.get("/cases/:id/sources", async (request) => {
    const params = parseOrThrow(paramsSchema, request.params);
    return listSources(params.id);
  });

  app.post("/cases/:id/sources", async (request, reply) => {
    const params = parseOrThrow(paramsSchema, request.params);
    const payload = parseOrThrow(createSourceSchema, request.body);
    const created = await createSource(params.id, payload);
    return sendCreated(reply, created);
  });
};
