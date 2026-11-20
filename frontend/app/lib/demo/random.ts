import seedrandom from "seedrandom";

/**
 * Deterministic randomness for the demo data.
 *
 * Sensor samples use a counter-based generator: every random number is a hash of (seed, slot, k), so a sample's value
 * only depends on *which* sample it is, never on which time window we happen to generate. That keeps values stable while
 * "today" grows minute by minute, and lets us generate any day lazily and independently.
 */

/** 32-bit FNV-1a hash of a string, used to derive numeric seeds from IDs and stream names. */
export function hashString(value: string): number {
	let hash = 0x811c9dc5;

	for (let index = 0; index < value.length; index++) {
		hash ^= value.charCodeAt(index);
		hash = Math.imul(hash, 0x01000193);
	}

	return hash >>> 0;
}

/** Finalizer from MurmurHash3/"lowbias32": a fast, well-distributed 32-bit integer mix. */
function mix32(input: number): number {
	let value = input;
	value = Math.imul(value ^ (value >>> 16), 0x7feb352d);
	value = Math.imul(value ^ (value >>> 15), 0x846ca68b);
	return (value ^ (value >>> 16)) >>> 0;
}

const UINT32_RANGE = 4294967296;

/** Uniform number in [0, 1) determined by `(seed, slot, k)`. */
export function unitRandom(seed: number, slot: number, k = 0): number {
	let hash = mix32(seed + 0x9e3779b9);
	hash = mix32(hash ^ slot);
	hash = mix32(hash ^ (k + 0x632be5ab));
	return hash / UINT32_RANGE;
}

/** Sequential generator, used where the seed SQL draws a fixed sequence of `random()` values (`setseed`). */
export function createSequentialRandom(seed: string): () => number {
	return seedrandom.alea(seed);
}

/** Piecewise-linear inverse CDF, given as `[cumulativeProbability, value]` pairs sorted by probability (0 to 1). */
export type QuantileTable = ReadonlyArray<readonly [number, number]>;

export function sampleQuantile(table: QuantileTable, probability: number): number {
	for (let index = 1; index < table.length; index++) {
		const [upperProbability, upperValue] = table[index];

		if (probability <= upperProbability) {
			const [lowerProbability, lowerValue] = table[index - 1];
			const span = upperProbability - lowerProbability;
			const fraction = span > 0 ? (probability - lowerProbability) / span : 0;
			return lowerValue + fraction * (upperValue - lowerValue);
		}
	}

	return table[table.length - 1][1];
}

/** Inverse CDF of a Poisson distribution with a small mean (sessions per minute). */
export function samplePoisson(mean: number, probability: number): number {
	let count = 0;
	let term = Math.exp(-mean);
	let cumulative = term;

	while (probability > cumulative && count < 20) {
		count++;
		term *= mean / count;
		cumulative += term;
	}

	return count;
}

/** Uniform number in `[min, max)`. */
export function lerp(min: number, max: number, unit: number): number {
	return min + (max - min) * unit;
}
