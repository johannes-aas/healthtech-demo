/**
 * Small helpers for building `Response` objects that look like the ones the ASP.NET backend returns.
 */

/** Thrown by demo handlers to short-circuit with an HTTP error, like returning `BadRequest(...)` in a controller. */
export class DemoHttpError extends Error {
	readonly status: number;
	/** JSON body, for errors the backend returns as objects (e.g. `BadRequest(new { error = ... })`). */
	readonly body: unknown;

	constructor(status: number, message: string, body?: unknown) {
		super(message);
		this.status = status;
		this.body = body;
	}
}

export const badRequest = (message: string) => new DemoHttpError(400, message);
export const badRequestObject = (error: string) => new DemoHttpError(400, error, { error });
export const notFound = (message = "Not Found") => new DemoHttpError(404, message);
export const internalServerError = (message = "Internal server error") => new DemoHttpError(500, message);

const GUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Mirrors ASP.NET model binding of a `Guid` route parameter: invalid values are a 400. Returns the normalized GUID. */
export function parseGuid(value: string): string {
	if (!GUID_PATTERN.test(value)) {
		throw badRequest(`The value '${value}' is not valid.`);
	}

	return value.toLowerCase();
}

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
