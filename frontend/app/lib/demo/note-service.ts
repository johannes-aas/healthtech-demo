import { internalServerError } from "./http.ts";
import { readStored, writeStored } from "./storage.ts";
import { getUserById } from "./user-service.ts";

/**
 * Port of `backend/src/Services/NoteDataService.cs`. Notes are stored per visitor in localStorage.
 *
 * DEMO DEVIATION: the backend rejects times that aren't in UTC ("Please provide time in UTC format"), but the frontend
 * sends TZDates, which always serialize with the Norwegian offset (e.g. `+01:00`). Against the real backend that makes
 * every notes call fail, so the demo accepts any offset and compares instants instead.
 */

export type DemoNote = {
	id: string;
	userId: string;
	/** UTC epoch milliseconds */
	time: number;
	note: string;
};

let notes: Array<DemoNote> | null = null;

function isNoteList(value: unknown): value is Array<DemoNote> {
	return (
		Array.isArray(value) &&
		value.every(
			(note: Partial<DemoNote> | null) =>
				typeof note?.id === "string" &&
				typeof note.userId === "string" &&
				typeof note.time === "number" &&
				typeof note.note === "string",
		)
	);
}

function getNotes(): Array<DemoNote> {
	notes ??= readStored("notes", isNoteList) ?? [];
	return notes;
}

function saveNotes() {
	writeStored("notes", getNotes());
}

export class NoteError extends Error {
	readonly kind: "argument" | "invalidOperation";

	constructor(kind: "argument" | "invalidOperation", message: string) {
		super(message);
		this.kind = kind;
	}
}

/** `GetNotesAsync`: the user's non-empty notes within the range, ordered by time. */
export function getNotesInRange(userId: string, startMs: number, endMs: number): Array<DemoNote> {
	return getNotes()
		.filter((note) => note.userId === userId && note.time >= startMs && note.time <= endMs && note.note !== "")
		.sort((a, b) => a.time - b.time);
}

/** `CreateNoteAsync` */
export function createNote(userId: string, time: number, text: string): DemoNote {
	if (getNotes().some((existing) => existing.time === time && existing.userId === userId)) {
		throw new NoteError("invalidOperation", "A note with this time already exists");
	}

	if (!getUserById(userId)) {
		// Foreign key violation in the backend
		throw internalServerError();
	}

	const note: DemoNote = { id: crypto.randomUUID(), userId, time, note: text };
	getNotes().push(note);
	saveNotes();

	return note;
}

/** `UpdateNoteAsync`. Like the backend, this finds the note by time only (any user). */
export function updateNote(time: number, text: string): DemoNote {
	const note = getNotes().find((candidate) => candidate.time === time);

	if (!note) {
		throw new NoteError("invalidOperation", "This is not a note that exists");
	}

	note.note = text;
	saveNotes();

	return note;
}

/** `DeleteNoteAsync`. Returns null if there is no note at that time for the user. */
export function deleteNote(time: number, userId: string): DemoNote | null {
	const note = getNotes().find((candidate) => candidate.time === time && candidate.userId === userId);

	if (!note) {
		return null;
	}

	notes = getNotes().filter((candidate) => candidate !== note);
	saveNotes();

	return note;
}

/** Cascade when a user is deleted (`NoteData.UserId` has `OnDelete(Cascade)`). */
export function deleteNotesForUser(userId: string) {
	notes = getNotes().filter((note) => note.userId !== userId);
	saveNotes();
}
