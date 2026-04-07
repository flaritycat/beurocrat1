import { apiBasePath } from "./config";

type RequestOptions = RequestInit & {
  bodyJson?: unknown;
};

export class ApiError extends Error {
  public readonly status: number;
  public readonly code?: string;

  constructor(status: number, message: string, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (response.ok) {
    return response.json() as Promise<T>;
  }

  let message = `Feil ${response.status}`;
  let code: string | undefined;

  try {
    const payload = await response.json();
    message = payload.error?.message ?? message;
    code = payload.error?.code;
  } catch {
    // ignore parsing failure
  }

  throw new ApiError(response.status, message, code);
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}) {
  const headers = new Headers(options.headers);

  if (options.bodyJson !== undefined) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${apiBasePath}${path}`, {
    ...options,
    headers,
    body: options.bodyJson !== undefined ? JSON.stringify(options.bodyJson) : options.body,
  });

  return handleResponse<T>(response);
}
