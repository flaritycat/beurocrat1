import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { parseOrThrow, sendCreated } from "../../lib/http";
import { generateOutput, generateOutputSchema, getOutput, listOutputs } from "./service";

const paramsSchema = z.object({
  id: z.string().uuid(),
});

const outputParamsSchema = z.object({
  id: z.string().uuid(),
  outputId: z.string().uuid(),
});

export const outputRoutes: FastifyPluginAsync = async (app) => {
  app.post("/cases/:id/outputs/generate", async (request, reply) => {
    const params = parseOrThrow(paramsSchema, request.params);
    const payload = parseOrThrow(generateOutputSchema, request.body ?? {});
    const generated = await generateOutput(params.id, payload.output_type);
    return sendCreated(reply, generated);
  });

  app.get("/cases/:id/outputs", async (request) => {
    const params = parseOrThrow(paramsSchema, request.params);
    return listOutputs(params.id);
  });

  app.get("/cases/:id/outputs/:outputId", async (request) => {
    const params = parseOrThrow(outputParamsSchema, request.params);
    return getOutput(params.id, params.outputId);
  });
};
