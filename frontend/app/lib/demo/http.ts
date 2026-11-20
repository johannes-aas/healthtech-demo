/**
 * Small helpers for building `Response` objects that look like the ones the ASP.NET backend returns.
 */

/** Thrown by demo handlers to short-circuit with an HTTP error, like returning `BadRequest(...)` in a controller. */
export class DemoHttpError extends Error {
	readonly status: number;

	constructor(status: number, message: string) {
		super(message);
		this.status = status;
	}
}

export const badRequest = (message: string) => new DemoHttpError(400, message);
export const notFound = (message = "Not Found") => new DemoHttpError(404, message);
export const internalServerError = (message = "Internal server error") => new DemoHttpError(500, message);

export function jsonResponse(body: unknown, status = 200): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { "Content-Type": "application/json; charset=utf-8" },
	});
}

export function noContentResponse(): Response {
	return new Response(null, { status: 204 });
}

export function textResponse(message: string, status: number): Response {
	return new Response(message, {
		status,
		headers: { "Content-Type": "text/plain; charset=utf-8" },
	});
}
