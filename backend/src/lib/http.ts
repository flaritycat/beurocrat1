import type { FastifyReply } from "fastify";
import { ZodError, type ZodTypeAny, z } from "zod";

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: unknown;

  constructor(statusCode: number, code: string, message: string, details?: unknown) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export function parseOrThrow<TSchema extends ZodTypeAny>(schema: TSchema, input: unknown): z.output<TSchema> {
  const result = schema.safeParse(input);

  if (!result.success) {
    throw new AppError(400, "VALIDATION_ERROR", "Ugyldig input", result.error.flatten());
  }

  return result.data;
}

export function sendCreated<T>(reply: FastifyReply, payload: T) {
  return reply.code(201).send(payload);
}

export function normalizeError(error: unknown) {
  if (error instanceof AppError) {
    return error;
  }

  if (error instanceof ZodError) {
    return new AppError(400, "VALIDATION_ERROR", "Ugyldig input", error.flatten());
  }

  return new AppError(500, "INTERNAL_SERVER_ERROR", "Uventet feil");
}
