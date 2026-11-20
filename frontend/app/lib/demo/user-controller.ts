import type { Exposure } from "@/features/exposure-picker/exposures.ts";
import type { DangerLevel } from "@/lib/danger-levels.ts";
import { getHighestDangerLevel } from "./backend-utils.ts";
import type { ExposureContext } from "./exposure-service.ts";
import { badRequest, notFound, parseGuid } from "./http.ts";
import type { DemoRequest } from "./router.ts";
import {
	getAllUsers,
	getSignedInUser,
	getSubordinates,
	getUserById,
	toUserDto,
	toUserWithStatusDto,
	type UserDto,
	type UserStatusDto,
	type UserWithStatusDto,
} from "./user-service.ts";
import { getStatusForUsersInRange } from "./user-status-service.ts";

/**
 * Port of `backend/src/Controllers/UserController.cs`.
 */

const DAY_MS = 24 * 60 * 60_000;

type ExposureThresholdSummaryDto = Record<DangerLevel, number>;

function getContext(signedInUserId: string): ExposureContext {
	return { signedInRole: getSignedInUser(signedInUserId)?.role, nowMs: Date.now() };
}

/** `[FromQuery] DateTime?`: missing or empty is null, anything unparsable is a 400. */
function parseQueryDateTime(query: URLSearchParams, name: string): number | null {
	const value = query.get(name);

	if (value === null || value === "") {
		return null;
	}

	const time = Date.parse(value);

	if (Number.isNaN(time)) {
		throw badRequest(`The value '${value}' is not valid for ${name}.`);
	}

	return time;
}

/** Defaults to the current (UTC) day if no time range is provided: `DateTime.UtcNow.Date` to the end of that day. */
function getRange(query: URLSearchParams, nowMs: number) {
	const startOfUtcDay = Math.floor(nowMs / DAY_MS) * DAY_MS;

	return {
		startMs: parseQueryDateTime(query, "startTime") ?? startOfUtcDay,
		// `.AddDays(1).AddTicks(-1)`; one tick is 100 ns, we only have millisecond resolution
		endMs: parseQueryDateTime(query, "endTime") ?? startOfUtcDay + DAY_MS - 1,
	};
}

// GET users
export function getAllUsersAction(): Array<UserDto> {
	return getAllUsers().map(toUserDto);
}

// GET users/{id}
export function getUserByIdAction({ params }: DemoRequest): UserDto {
	const user = getUserById(parseGuid(params.id));

	if (!user) {
		throw notFound();
	}

	return toUserDto(user);
}

// GET users/{managerId}/subordinates
export function getSubordinatesAction({ params, query, signedInUserId }: DemoRequest): Array<UserWithStatusDto> {
	const subordinates = getSubordinates(parseGuid(params.id));
	const context = getContext(signedInUserId);
	const { startMs, endMs } = getRange(query, context.nowMs);

	const userStatuses = getStatusForUsersInRange(
		subordinates.map((user) => user.id),
		startMs,
		endMs,
		context,
	);

	return subordinates.map((user) => {
		const status: UserStatusDto = userStatuses.find((candidate) => candidate.userId === user.id) ?? {
			userId: user.id,
			status: "safe",
			noise: null,
			dust: null,
			vibration: null,
		};

		return toUserWithStatusDto(user, status);
	});
}

// GET users/{managerId}/subordinates/threshold-summary
export function getSubordinatesThresholdStatusAction({ params, query, signedInUserId }: DemoRequest) {
	const subordinates = getSubordinates(parseGuid(params.id));

	if (subordinates.length === 0) {
		return {};
	}

	const context = getContext(signedInUserId);
	const { startMs, endMs } = getRange(query, context.nowMs);

	const userStatuses = getStatusForUsersInRange(
		subordinates.map((user) => user.id),
		startMs,
		endMs,
		context,
	);

	const summary: Record<Exposure | "total", ExposureThresholdSummaryDto> = {
		noise: { safe: 0, warning: 0, danger: 0 },
		dust: { safe: 0, warning: 0, danger: 0 },
		vibration: { safe: 0, warning: 0, danger: 0 },
		total: { safe: 0, warning: 0, danger: 0 },
	};

	const incrementBucket = (counts: ExposureThresholdSummaryDto, level: DangerLevel | undefined) => {
		if (level) {
			counts[level]++;
		}
	};

	for (const status of userStatuses) {
		incrementBucket(summary.noise, status.noise?.dangerLevel);
		incrementBucket(summary.dust, status.dust?.dangerLevel);
		incrementBucket(summary.vibration, status.vibration?.dangerLevel);

		const highest = getHighestDangerLevel(
			status.noise?.dangerLevel,
			status.dust?.dangerLevel,
			status.vibration?.dangerLevel,
		);

		incrementBucket(summary.total, highest);
	}

	return summary;
}
