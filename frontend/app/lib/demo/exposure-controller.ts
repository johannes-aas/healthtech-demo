import type { Exposure } from "@/features/exposure-picker/exposures.ts";
import {
	type AggregateFnKey,
	aggregateFnEnum,
	type ExposureTypeField,
	ExposureTypeFieldSchema,
	type GranularityKey,
	granularityEnum,
} from "@/lib/dto/exposure.ts";
import {
	type CombinedExposureBucket,
	type ExposureContext,
	type ExposureData,
	type ExposureRequest,
	getAggregatedData,
	getHourDomainForWeek,
	getOverviewData,
} from "./exposure-service.ts";
import { badRequest, badRequestObject, parseGuid } from "./http.ts";
import type { DemoRequest } from "./router.ts";
import { getSignedInUser } from "./user-service.ts";

/**
 * Port of `backend/src/Controllers/ExposureDataController.cs`, including request binding/validation and
 * `ValidateFieldForExposureTypeFilter`.
 */

// Backend enum order: `ExposureType { Noise, Vibration, Dust }`
const EXPOSURE_TYPES: ReadonlyArray<Exposure> = ["noise", "vibration", "dust"];
const GRANULARITIES = Object.keys(granularityEnum) as Array<GranularityKey>;
const AGGREGATE_FUNCTIONS = Object.keys(aggregateFnEnum) as Array<AggregateFnKey>;
const FIELDS: ReadonlyArray<ExposureTypeField> = ExposureTypeFieldSchema.options;

/** Fields that belong to each exposure type (`[ExposureTypeField(...)]` attributes): all of them are dust fields. */
const VALID_FIELDS: Record<Exposure, ReadonlyArray<ExposureTypeField>> = {
	dust: FIELDS,
	noise: [],
	vibration: [],
};

/** Like `Enum.TryParse(value, ignoreCase: true)` / `JsonStringEnumConverter`: a name (any case) or the numeric value. */
function parseEnum<T extends string>(value: unknown, names: ReadonlyArray<T>): T | null {
	if (typeof value === "number") {
		return Number.isInteger(value) ? (names[value] ?? null) : null;
	}

	if (typeof value !== "string") {
		return null;
	}

	if (/^\d+$/.test(value)) {
		return names[Number(value)] ?? null;
	}

	return names.find((name) => name.toLowerCase() === value.toLowerCase()) ?? null;
}

function parseExposureType(value: string): Exposure {
	const exposure = parseEnum(value, EXPOSURE_TYPES);

	if (!exposure) {
		throw badRequestObject("Invalid or missing exposureType.");
	}

	return exposure;
}

function parseDateTimeOffset(value: unknown, name: string): number {
	const time = typeof value === "string" ? Date.parse(value) : Number.NaN;

	if (Number.isNaN(time)) {
		throw badRequest(`The ${name} field is required.`);
	}

	return time;
}

/** Binds an `ExposureDataRequestDto` from JSON. */
function parseExposureRequest(body: unknown): ExposureRequest {
	if (typeof body !== "object" || body === null) {
		throw badRequest("A non-empty request body is required.");
	}

	const dto = body as Record<string, unknown>;
	const granularity = parseEnum(dto.granularity, GRANULARITIES);
	const fn = parseEnum(dto.function, AGGREGATE_FUNCTIONS);
	const field = dto.field === undefined || dto.field === null ? null : parseEnum(dto.field, FIELDS);

	if (!granularity) {
		throw badRequest("The Granularity field is required.");
	}
	if (!fn) {
		throw badRequest("The Function field is required.");
	}
	if (field === null && dto.field !== undefined && dto.field !== null) {
		throw badRequest("The Field field is invalid.");
	}

	return {
		startMs: parseDateTimeOffset(dto.startTime, "StartTime"),
		endMs: parseDateTimeOffset(dto.endTime, "EndTime"),
		granularity,
		function: fn,
		field,
	};
}

/** `ValidateFieldForExposureTypeFilter` */
function validateFieldForExposureType(exposure: Exposure, field: ExposureTypeField | null) {
	const validFields = VALID_FIELDS[exposure];
	const typeName = exposure.charAt(0).toUpperCase() + exposure.slice(1);

	if (validFields.length === 0 && field !== null) {
		throw badRequestObject(`Field must not be specified for ${typeName}.`);
	}

	if (validFields.length > 0) {
		if (field === null) {
			throw badRequestObject(`Field is required for ${typeName}.`);
		}

		if (!validFields.includes(field)) {
			throw badRequestObject(`Field '${field}' is not valid for ${typeName}.`);
		}
	}
}

function getContext(signedInUserId: string): ExposureContext {
	return { signedInRole: getSignedInUser(signedInUserId)?.role, nowMs: Date.now() };
}

// --- Wire format ---

const toIsoString = (time: number) => new Date(time).toISOString();

const toExposureDataDto = (data: ExposureData) => ({ ...data, time: toIsoString(data.time) });

const toCombinedExposureBucketDto = (bucket: CombinedExposureBucket) => ({ ...bucket, time: toIsoString(bucket.time) });

// --- Actions ---

// POST exposure/{exposureType}/{userId}
export function getAggregatedDataAction({ params, body, signedInUserId }: DemoRequest) {
	const exposure = parseExposureType(params.exposureType);
	const userId = parseGuid(params.userId);
	const request = parseExposureRequest(body);
	validateFieldForExposureType(exposure, request.field);

	if (request.startMs >= request.endMs) {
		throw badRequest("StartTime must be earlier than EndTime.");
	}

	// Errors past this point become a 500 ("Internal server error"), like the catch-all in the controller
	const context = getContext(signedInUserId);
	const data = getAggregatedData(request, userId, exposure, context);
	const hourDomain = getHourDomainForWeek([[exposure, request]], userId, context);

	return { data: data.map(toExposureDataDto), hourDomain };
}

// POST exposure/overview/{userId}
export function getOverviewDataAction({ params, body, signedInUserId }: DemoRequest) {
	const userId = parseGuid(params.userId);

	if (typeof body !== "object" || body === null) {
		throw badRequest("A non-empty request body is required.");
	}

	const requests = Object.entries(body).map(([key, value]): [Exposure, ExposureRequest] => {
		const exposure = parseEnum(key, EXPOSURE_TYPES);

		if (!exposure) {
			throw badRequest(`The JSON value could not be converted to ExposureType: ${key}`);
		}

		return [exposure, parseExposureRequest(value)];
	});

	const context = getContext(signedInUserId);
	const data = getOverviewData(requests, userId, context);
	const hourDomain = getHourDomainForWeek(requests, userId, context);

	return { data: data.map(toCombinedExposureBucketDto), hourDomain };
}
