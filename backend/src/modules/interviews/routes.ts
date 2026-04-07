import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { parseOrThrow, sendCreated } from "../../lib/http";
import { answerInterviewSchema, generateInterviewSummary, getInterview, saveInterviewAnswer } from "./service";

const paramsSchema = z.object({
  id: z.string().uuid(),
});

export const interviewRoutes: FastifyPluginAsync = async (app) => {
  app.get("/cases/:id/interview", async (request) => {
    const params = parseOrThrow(paramsSchema, request.params);
    return getInterview(params.id);
  });

  app.post("/cases/:id/interview/answer", async (request, reply) => {
    const params = parseOrThrow(paramsSchema, request.params);
    const payload = parseOrThrow(answerInterviewSchema, request.body);
    const result = await saveInterviewAnswer(params.id, payload);
    return sendCreated(reply, result);
  });

  app.post("/cases/:id/interview/generate-summary", async (request) => {
    const params = parseOrThrow(paramsSchema, request.params);
    return generateInterviewSummary(params.id);
  });
};
