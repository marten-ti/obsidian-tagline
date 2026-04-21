export interface FieldPosition {
	key: string;
	startPos: number;
	endPos: number;
	valueStartPos: number;
	valueEndPos: number;
	value: string;
}

// Matches [key:: value] - key can contain spaces, value can be empty or have content
const FIELD_REGEX = /\[([a-zA-Z_][a-zA-Z0-9_ ]*):: ([^\]]*)\]/g;

export function getFieldPositions(line: string): FieldPosition[] {
	const fields: FieldPosition[] = [];
	let match;

	while ((match = FIELD_REGEX.exec(line)) !== null) {
		const key = match[1];
		const value = match[2];
		if (key !== undefined && value !== undefined) {
			const startPos = match.index;
			const endPos = match.index + match[0].length;
			// valueStartPos: position right after ":: "
			// For [prio:: value], that's: [ + key + :: + space = 1 + keyLen + 2 + 1 = keyLen + 4
			const valueStartPos = match.index + 1 + key.length + 3; // after "[key:: "
			// valueEndPos: position of the "]" (exclusive end for cursor range)
			const valueEndPos = endPos - 1;

			fields.push({
				key,
				startPos,
				endPos,
				valueStartPos,
				valueEndPos,
				value: value.trim() // trim the captured value
			});
		}
	}

	FIELD_REGEX.lastIndex = 0;
	return fields;
}

export function isInsideField(line: string, cursorCh: number): FieldPosition | null {
	const fields = getFieldPositions(line);

	for (const field of fields) {
		// Allow valueEndPos + 1 to include cursor at the "]" position (for FieldValueSuggestor)
		if (cursorCh >= field.valueStartPos && cursorCh <= field.valueEndPos + 1) {
			return field;
		}
	}

	return null;
}

export function findNextField(line: string, cursorCh: number): FieldPosition | null {
	const fields = getFieldPositions(line);

	for (const field of fields) {
		if (field.valueStartPos > cursorCh) {
			return field;
		}
	}

	return fields.length > 0 ? fields[0] ?? null : null;
}

export function findPrevField(line: string, cursorCh: number): FieldPosition | null {
	const fields = getFieldPositions(line);

	for (let i = fields.length - 1; i >= 0; i--) {
		const field = fields[i];
		if (field && field.valueEndPos < cursorCh) {
			return field;
		}
	}

	return fields.length > 0 ? fields[fields.length - 1] ?? null : null;
}

export function findNextEmptyField(line: string, cursorCh: number): FieldPosition | null {
	const fields = getFieldPositions(line);

	for (const field of fields) {
		if (field.valueStartPos > cursorCh && field.value.trim() === '') {
			return field;
		}
	}

	for (const field of fields) {
		if (field.value.trim() === '' && field.valueStartPos !== cursorCh) {
			return field;
		}
	}

	return null;
}
