import { DEFAULT_USER } from "@/features/user/user-utils.ts";
import { DemoHttpError, jsonResponse, noContentResponse, notFound, textResponse } from "./http.ts";
import { getAllUsersAction, getSubordinatesAction, getUserByIdAction } from "./user-controller.ts";

/**
 * In-browser replacement for the backend API, used when `VITE_DEMO_MODE=true`.
 *
 * Every route mirrors an action in `backend/src/Controllers`. Handlers receive the parsed request and return either a
 * JSON-serializable body or a ready-made `Response`.
 */

type HttpMethod = "GET" | "POST" | "PUT" | "DELETE";

export type DemoRequest = {
	params: Record<string, string>;
	query: URLSearchParams;
	body: unknown;
	signedInUserId: string;
};

type Handler = (request: DemoRequest) => unknown;

type Route = {
	method: HttpMethod;
	segments: Array<string>;
	handler: Handler;
};

// Any valid absolute URL works; it is only used to split the relative API path into path and query parts.
const PARSE_BASE_URL = "http://demo.invalid/api/";

const EMPTY_THRESHOLD_COUNTS = { safe: 0, warning: 0, danger: 0 };

const routes: Array<Route> = [];

function route(method: HttpMethod, pattern: string, handler: Handler) {
	routes.push({ method, segments: pattern.split("/"), handler });
}

// NOTE: Order matters, the first matching route wins (`exposure/overview/:userId` must come before `exposure/:exposureType/:userId`).

// ExposureDataController
route("POST", "exposure/overview/:userId", () => ({
	data: [],
	hourDomain: { minHourUtc: 0, maxHourUtc: 23 },
}));
route("POST", "exposure/:exposureType/:userId", () => ({
	data: [],
	hourDomain: { minHourUtc: 0, maxHourUtc: 23 },
}));

// NoteDataController
route("POST", "notes/:userId/create", ({ body }) => body);
route("POST", "notes/:userId", () => []);
route("PUT", "notes/:userId", ({ body }) => body);
route("DELETE", "notes/:userId", ({ body }) => ({ note: "", time: body }));

// UserController
route("GET", "users", getAllUsersAction);
route("GET", "users/:id/subordinates/threshold-summary", () => ({
	noise: EMPTY_THRESHOLD_COUNTS,
	dust: EMPTY_THRESHOLD_COUNTS,
	vibration: EMPTY_THRESHOLD_COUNTS,
	total: EMPTY_THRESHOLD_COUNTS,
}));
route("GET", "users/:id/subordinates", getSubordinatesAction);
route("GET", "users/:id", getUserByIdAction);
route("POST", "users", () => DEFAULT_USER);
route("PUT", "users/:id/subordinates/delete", () => DEFAULT_USER);
route("PUT", "users/:id/subordinates/create", () => DEFAULT_USER);
route("PUT", "users/:id", () => DEFAULT_USER);
route("DELETE", "users/:id", () => noContentResponse());

function matchRoute(method: string, pathSegments: Array<string>) {
	for (const candidate of routes) {
		if (candidate.method !== method || candidate.segments.length !== pathSegments.length) {
			continue;
		}

		const params: Record<string, string> = {};
		const isMatch = candidate.segments.every((segment, index) => {
			const value = pathSegments[index];

			if (segment.startsWith(":")) {
				params[segment.slice(1)] = value;
				return true;
			}

			return segment.toLowerCase() === value.toLowerCase();
		});

		if (isMatch) {
			return { handler: candidate.handler, params };
		}
	}

	return null;
}

function parseBody(body: RequestInit["body"]): unknown {
	if (typeof body !== "string" || body.length === 0) {
		return undefined;
	}

	return JSON.parse(body);
}

export async function handleDemoRequest(
	path: string,
	init: RequestInit | undefined,
	signedInUserId: string,
): Promise<Response> {
	const url = new URL(path, PARSE_BASE_URL);
	const method = (init?.method ?? "GET").toUpperCase();
	const pathSegments = url.pathname
		.replace(/^\/api\//, "")
		.split("/")
		.filter((segment) => segment.length > 0)
		.map((segment) => decodeURIComponent(segment));

	const match = matchRoute(method, pathSegments);

	if (!match) {
		return textResponse(notFound().message, 404);
	}

	try {
		const result = await match.handler({
			params: match.params,
			query: url.searchParams,
			body: parseBody(init?.body),
			signedInUserId,
		});

		return result instanceof Response ? result : jsonResponse(result);
	} catch (error) {
		if (error instanceof DemoHttpError) {
			return textResponse(error.message, error.status);
		}

		console.error("Demo API handler failed", error);
		return textResponse("Internal server error", 500);
	}
}
