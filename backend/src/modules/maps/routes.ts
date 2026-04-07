import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { parseOrThrow } from "../../lib/http";
import { geocodeLocation, searchMapContext } from "./service";

const geocodeQuerySchema = z.object({
  query: z.string().trim().min(2),
});

const searchQuerySchema = z.object({
  query: z.string().trim().optional(),
  municipality: z.string().trim().optional(),
  issueType: z.string().trim().optional(),
});

export const mapRoutes: FastifyPluginAsync = async (app) => {
  app.get("/maps/geocode", async (request) => {
    const query = parseOrThrow(geocodeQuerySchema, request.query);
    return geocodeLocation(query.query);
  });

  app.get("/maps/search", async (request) => {
    const query = parseOrThrow(searchQuerySchema, request.query);
    return searchMapContext(query.query, query.municipality, query.issueType);
  });
};
