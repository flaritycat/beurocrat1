import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { AppError, parseOrThrow, sendCreated } from "../../lib/http";
import { createEvidence, createEvidenceSchema, listEvidence } from "./service";

const paramsSchema = z.object({
  id: z.string().uuid(),
});

export const evidenceRoutes: FastifyPluginAsync = async (app) => {
  app.get("/cases/:id/evidence", async (request) => {
    const params = parseOrThrow(paramsSchema, request.params);
    return listEvidence(params.id);
  });

  app.post("/cases/:id/evidence", async (request, reply) => {
    const params = parseOrThrow(paramsSchema, request.params);
    const payload = parseOrThrow(createEvidenceSchema, request.body);
    const created = await createEvidence(params.id, payload);
    return sendCreated(reply, created);
  });

  app.post("/cases/:id/evidence/upload", async (request) => {
    parseOrThrow(paramsSchema, request.params);
    throw new AppError(
      403,
      "FILE_UPLOAD_DISABLED",
      "Filopplasting er deaktivert. Dokumenter og vedlegg skal ikke lastes opp her.",
    );
  });
};
