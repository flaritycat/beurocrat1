import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { parseOrThrow, sendCreated } from "../../lib/http";
import { createTimelineEvent, createTimelineEventSchema, listTimeline } from "./service";

const paramsSchema = z.object({
  id: z.string().uuid(),
});

export const timelineRoutes: FastifyPluginAsync = async (app) => {
  app.get("/cases/:id/timeline", async (request) => {
    const params = parseOrThrow(paramsSchema, request.params);
    return listTimeline(params.id);
  });

  app.post("/cases/:id/timeline", async (request, reply) => {
    const params = parseOrThrow(paramsSchema, request.params);
    const payload = parseOrThrow(createTimelineEventSchema, request.body);
    const created = await createTimelineEvent(params.id, payload);
    return sendCreated(reply, created);
  });
};
