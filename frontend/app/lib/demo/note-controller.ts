import { badRequest, notFound, parseGuid } from "./http.ts";
import { createNote, type DemoNote, deleteNote, getNotesInRange, NoteError, updateNote } from "./note-service.ts";
import type { DemoRequest } from "./router.ts";

/**
 * Port of `backend/src/Controllers/NoteDataController.cs`.
 */

type NoteDataDto = { time: string; note: string };

const toNoteDataDto = (note: DemoNote): NoteDataDto => ({ time: new Date(note.time).toISOString(), note: note.note });

/** Binds a JSON `DateTimeOffset`. Returns null when missing. */
function parseDateTimeOffset(value: unknown, name: string): number | null {
	if (value === undefined || value === null) {
		return null;
	}

	const time = typeof value === "string" ? Date.parse(value) : Number.NaN;

	if (Number.isNaN(time)) {
		throw badRequest(`The JSON value could not be converted to System.DateTimeOffset. Path: $.${name}`);
	}

	return time;
}

function asObject(body: unknown): Record<string, unknown> {
	if (typeof body !== "object" || body === null) {
		throw badRequest("A non-empty request body is required.");
	}

	return body as Record<string, unknown>;
}

/** `[Required] DateTimeOffset? Time` and `[Required] string Note` (empty strings fail `[Required]`). */
function parseNoteBody(body: unknown): { time: number; note: string } {
	const dto = asObject(body);
	const time = parseDateTimeOffset(dto.time, "time");

	if (time === null) {
		throw badRequest("The Time field is required.");
	}

	if (typeof dto.note !== "string" || dto.note === "") {
		throw badRequest("The Note field is required.");
	}

	return { time, note: dto.note };
}

/** `catch (InvalidOperationException/ArgumentException ex) { return BadRequest(ex.Message); }` */
function withBadRequestOnNoteError<T>(action: () => T): T {
	try {
		return action();
	} catch (error) {
		if (error instanceof NoteError) {
			throw badRequest(error.message);
		}

		throw error;
	}
}

// POST notes/{userId}
export function getNotesAction({ params, body }: DemoRequest): Array<NoteDataDto> {
	const userId = parseGuid(params.userId);
	const dto = asObject(body);
	const startMs = parseDateTimeOffset(dto.startTime, "startTime");
	const endMs = parseDateTimeOffset(dto.endTime, "endTime");

	if (startMs === null || endMs === null) {
		// `request.StartTime!.Value` on null throws an InvalidOperationException, which isn't caught: a 500
		throw new Error("Nullable object must have a value.");
	}

	return getNotesInRange(userId, startMs, endMs).map(toNoteDataDto);
}

// POST notes/{userId}/create
export function createNoteAction({ params, body }: DemoRequest): NoteDataDto {
	const userId = parseGuid(params.userId);
	const { time, note } = parseNoteBody(body);

	return toNoteDataDto(withBadRequestOnNoteError(() => createNote(userId, time, note)));
}

// PUT notes/{userId}
export function updateNoteAction({ params, body }: DemoRequest): NoteDataDto {
	parseGuid(params.userId);
	const { time, note } = parseNoteBody(body);

	return toNoteDataDto(withBadRequestOnNoteError(() => updateNote(time, note)));
}

// DELETE notes/{userId}
export function deleteNoteAction({ params, body }: DemoRequest): NoteDataDto {
	const userId = parseGuid(params.userId);
	const time = parseDateTimeOffset(body, "");

	if (time === null) {
		throw badRequest("A non-empty request body is required.");
	}

	const note = deleteNote(time, userId);

	if (!note) {
		throw notFound("Note not found");
	}

	return toNoteDataDto(note);
}
