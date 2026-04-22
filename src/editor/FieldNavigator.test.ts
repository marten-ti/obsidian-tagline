import { describe, it, expect } from 'vitest';
import {
	getFieldPositions,
	isInsideField,
	findNextField,
	findPrevField,
	findNextEmptyField,
	FieldPosition,
} from './FieldNavigator';

describe('getFieldPositions', () => {
	describe('basic parsing', () => {
		it('parses a single field with value', () => {
			const fields = getFieldPositions('[prio:: high]');
			expect(fields).toHaveLength(1);
			expect(fields[0]).toMatchObject({
				key: 'prio',
				value: 'high',
				startPos: 0,
				endPos: 13,
				valueStartPos: 8,
				valueEndPos: 12,
			});
		});

		it('parses a single empty field', () => {
			const fields = getFieldPositions('[prio:: ]');
			expect(fields).toHaveLength(1);
			expect(fields[0]).toMatchObject({
				key: 'prio',
				value: '',
				valueStartPos: 8,
				valueEndPos: 8,
			});
		});

		it('parses multiple fields', () => {
			const fields = getFieldPositions('[a:: 1] [b:: 2] [c:: 3]');
			expect(fields).toHaveLength(3);
			expect(fields.map(f => f.key)).toEqual(['a', 'b', 'c']);
			expect(fields.map(f => f.value)).toEqual(['1', '2', '3']);
		});

		it('returns empty array for no fields', () => {
			expect(getFieldPositions('just some text')).toEqual([]);
			expect(getFieldPositions('')).toEqual([]);
		});

		it('handles field with surrounding text', () => {
			const fields = getFieldPositions('Some text [prio:: high] more text');
			expect(fields).toHaveLength(1);
			expect(fields[0]?.startPos).toBe(10);
		});
	});

	describe('field key formats', () => {
		it('parses underscore in key name', () => {
			const fields = getFieldPositions('[my_field:: value]');
			expect(fields[0]?.key).toBe('my_field');
		});

		it('parses numbers in key name', () => {
			const fields = getFieldPositions('[field123:: value]');
			expect(fields[0]?.key).toBe('field123');
		});

		it('parses key starting with underscore', () => {
			const fields = getFieldPositions('[_private:: value]');
			expect(fields[0]?.key).toBe('_private');
		});

		it('does not parse key starting with number', () => {
			const fields = getFieldPositions('[123field:: value]');
			expect(fields).toHaveLength(0);
		});

		it('parses key with spaces', () => {
			const fields = getFieldPositions('[my field:: value]');
			expect(fields).toHaveLength(1);
			expect(fields[0]?.key).toBe('my field');
		});

		it('parses key with multiple spaces', () => {
			const fields = getFieldPositions('[new field name:: value]');
			expect(fields[0]?.key).toBe('new field name');
		});

		it('parses key with hyphen', () => {
			const fields = getFieldPositions('[my-field:: value]');
			expect(fields).toHaveLength(1);
			expect(fields[0]?.key).toBe('my-field');
		});

		it('parses key with ampersand', () => {
			const fields = getFieldPositions('[date&time:: 2026-04-21]');
			expect(fields).toHaveLength(1);
			expect(fields[0]?.key).toBe('date&time');
		});
	});

	describe('field value formats', () => {
		it('trims whitespace from value', () => {
			const fields = getFieldPositions('[key::   spaced   ]');
			expect(fields[0]?.value).toBe('spaced');
		});

		it('handles value with multiple words', () => {
			const fields = getFieldPositions('[key:: multiple words here]');
			expect(fields[0]?.value).toBe('multiple words here');
		});

		it('handles wikilink value', () => {
			const fields = getFieldPositions('[People:: [[Frey, Florian]]]');
			expect(fields).toHaveLength(1);
			expect(fields[0]?.value).toBe('[[Frey, Florian]]');
		});

		it('handles multiple fields with wikilinks', () => {
			const line = '[People:: [[John]]] [Project:: [[My Project]]]';
			const fields = getFieldPositions(line);
			expect(fields).toHaveLength(2);
			expect(fields[0]?.value).toBe('[[John]]');
			expect(fields[1]?.value).toBe('[[My Project]]');
		});

		it('handles value with special characters', () => {
			const fields = getFieldPositions('[key:: value-with_special.chars!]');
			expect(fields[0]?.value).toBe('value-with_special.chars!');
		});

		it('handles value with numbers', () => {
			const fields = getFieldPositions('[priority:: 42]');
			expect(fields[0]?.value).toBe('42');
		});
	});

	describe('real-world line formats', () => {
		it('parses todo line with tag and fields', () => {
			const fields = getFieldPositions('#todo [prio:: ] [due:: ] [newfield:: none]');
			expect(fields).toHaveLength(3);
			expect(fields[0]).toMatchObject({ key: 'prio', value: '' });
			expect(fields[1]).toMatchObject({ key: 'due', value: '' });
			expect(fields[2]).toMatchObject({ key: 'newfield', value: 'none' });
		});

		it('parses line with filled and empty fields', () => {
			const fields = getFieldPositions('[status:: done] [notes:: ] [priority:: high]');
			expect(fields).toHaveLength(3);
			expect(fields[0]?.value).toBe('done');
			expect(fields[1]?.value).toBe('');
			expect(fields[2]?.value).toBe('high');
		});
	});
});

describe('isInsideField', () => {
	const testLine = '#todo [prio:: high] [due:: ] [status:: done]';
	// Positions:      0    6          19 20      28 29           43

	describe('cursor inside field value', () => {
		it('returns field when cursor at value start', () => {
			// [prio:: high] - valueStartPos is after ":: "
			const fields = getFieldPositions(testLine);
			const prioField = fields[0]!;
			const result = isInsideField(testLine, prioField.valueStartPos);
			expect(result).not.toBeNull();
			expect(result?.key).toBe('prio');
		});

		it('returns field when cursor in middle of value', () => {
			const fields = getFieldPositions(testLine);
			const prioField = fields[0]!;
			const result = isInsideField(testLine, prioField.valueStartPos + 2);
			expect(result?.key).toBe('prio');
		});

		it('returns field when cursor at value end', () => {
			const fields = getFieldPositions(testLine);
			const prioField = fields[0]!;
			const result = isInsideField(testLine, prioField.valueEndPos);
			expect(result?.key).toBe('prio');
		});

		it('returns field when cursor at ] position (valueEndPos + 1)', () => {
			const fields = getFieldPositions(testLine);
			const prioField = fields[0]!;
			const result = isInsideField(testLine, prioField.valueEndPos + 1);
			expect(result?.key).toBe('prio');
		});
	});

	describe('cursor inside empty field', () => {
		it('returns field when cursor in empty field value area', () => {
			// [due:: ] is the second field with empty value
			const fields = getFieldPositions(testLine);
			const dueField = fields[1]!;
			expect(dueField.value).toBe('');
			const result = isInsideField(testLine, dueField.valueStartPos);
			expect(result?.key).toBe('due');
		});
	});

	describe('cursor outside fields', () => {
		it('returns null when cursor before any field', () => {
			expect(isInsideField(testLine, 0)).toBeNull();
			expect(isInsideField(testLine, 3)).toBeNull();
		});

		it('returns null when cursor between fields', () => {
			const fields = getFieldPositions(testLine);
			const betweenPos = fields[0]!.endPos + 1;
			expect(isInsideField(testLine, betweenPos)).toBeNull();
		});

		it('returns null when cursor well after all fields', () => {
			// testLine ends with ] at position 43, valueEndPos + 1 = 44 is still "inside"
			// Position 45+ would be outside
			const lineWithTrailingText = testLine + ' extra';
			expect(isInsideField(lineWithTrailingText, testLine.length + 2)).toBeNull();
		});

		it('returns null for line with no fields', () => {
			expect(isInsideField('just plain text', 5)).toBeNull();
		});

		it('returns null for empty line', () => {
			expect(isInsideField('', 0)).toBeNull();
		});
	});
});

describe('findNextField', () => {
	const testLine = '[a:: 1] [b:: 2] [c:: 3]';

	describe('forward navigation', () => {
		it('finds next field when cursor in first field', () => {
			const fields = getFieldPositions(testLine);
			const result = findNextField(testLine, fields[0]!.valueStartPos);
			expect(result?.key).toBe('b');
		});

		it('finds next field when cursor in middle field', () => {
			const fields = getFieldPositions(testLine);
			const result = findNextField(testLine, fields[1]!.valueStartPos);
			expect(result?.key).toBe('c');
		});
	});

	describe('wrap-around behavior', () => {
		it('wraps to first field when cursor in last field', () => {
			const fields = getFieldPositions(testLine);
			const result = findNextField(testLine, fields[2]!.valueStartPos);
			expect(result?.key).toBe('a');
		});

		it('wraps to first field when cursor after last field', () => {
			const result = findNextField(testLine, testLine.length);
			expect(result?.key).toBe('a');
		});
	});

	describe('edge cases', () => {
		it('returns first field when cursor at start of line', () => {
			const result = findNextField(testLine, 0);
			expect(result?.key).toBe('a');
		});

		it('returns null for line with no fields', () => {
			expect(findNextField('no fields here', 5)).toBeNull();
		});

		it('returns the only field for single-field line', () => {
			const result = findNextField('[only:: one]', 5);
			expect(result?.key).toBe('only');
		});
	});
});

describe('findPrevField', () => {
	const testLine = '[a:: 1] [b:: 2] [c:: 3]';

	describe('backward navigation', () => {
		it('finds previous field when cursor in last field', () => {
			const fields = getFieldPositions(testLine);
			const result = findPrevField(testLine, fields[2]!.valueStartPos);
			expect(result?.key).toBe('b');
		});

		it('finds previous field when cursor in middle field', () => {
			const fields = getFieldPositions(testLine);
			const result = findPrevField(testLine, fields[1]!.valueStartPos);
			expect(result?.key).toBe('a');
		});
	});

	describe('wrap-around behavior', () => {
		it('wraps to last field when cursor in first field', () => {
			const fields = getFieldPositions(testLine);
			const result = findPrevField(testLine, fields[0]!.valueStartPos);
			expect(result?.key).toBe('c');
		});

		it('wraps to last field when cursor before first field', () => {
			const result = findPrevField(testLine, 0);
			expect(result?.key).toBe('c');
		});
	});

	describe('edge cases', () => {
		it('returns null for line with no fields', () => {
			expect(findPrevField('no fields here', 5)).toBeNull();
		});

		it('returns the only field for single-field line', () => {
			const result = findPrevField('[only:: one]', 10);
			expect(result?.key).toBe('only');
		});
	});
});

describe('findNextEmptyField', () => {
	describe('finding empty fields', () => {
		it('finds next empty field after cursor', () => {
			const line = '[filled:: value] [empty:: ] [also_filled:: x]';
			const fields = getFieldPositions(line);
			const result = findNextEmptyField(line, fields[0]!.valueStartPos);
			expect(result?.key).toBe('empty');
		});

		it('skips filled fields to find empty one', () => {
			const line = '[a:: 1] [b:: 2] [c:: ]';
			const result = findNextEmptyField(line, 0);
			expect(result?.key).toBe('c');
		});

		it('finds first empty field when multiple empty exist', () => {
			const line = '[a:: 1] [b:: ] [c:: ]';
			const result = findNextEmptyField(line, 0);
			expect(result?.key).toBe('b');
		});
	});

	describe('wrap-around behavior', () => {
		it('wraps around to find earlier empty field', () => {
			const line = '[empty:: ] [filled:: value]';
			const fields = getFieldPositions(line);
			// Cursor after both fields - should wrap to find the empty one
			const result = findNextEmptyField(line, fields[1]!.valueEndPos);
			expect(result?.key).toBe('empty');
		});
	});

	describe('no empty fields', () => {
		it('returns null when all fields are filled', () => {
			const line = '[a:: 1] [b:: 2] [c:: 3]';
			expect(findNextEmptyField(line, 0)).toBeNull();
		});

		it('returns null for line with no fields', () => {
			expect(findNextEmptyField('no fields', 0)).toBeNull();
		});
	});

	describe('whitespace handling', () => {
		it('treats field with only spaces as empty', () => {
			const line = '[key::    ]';
			const result = findNextEmptyField(line, 0);
			expect(result?.key).toBe('key');
		});
	});
});

describe('Tab navigation simulation', () => {
	// These tests simulate the actual Tab key behavior

	describe('fields with spaces in key names', () => {
		const line = '#todo [prio:: ] [due:: ] [new field:: ]';

		it('parses all three fields including one with space in name', () => {
			const fields = getFieldPositions(line);
			expect(fields).toHaveLength(3);
			expect(fields.map(f => f.key)).toEqual(['prio', 'due', 'new field']);
		});

		it('Tab from prio -> due', () => {
			const fields = getFieldPositions(line);
			const prioField = fields.find(f => f.key === 'prio')!;
			const nextField = findNextField(line, prioField.valueStartPos);
			expect(nextField?.key).toBe('due');
		});

		it('Tab from due -> new field', () => {
			const fields = getFieldPositions(line);
			const dueField = fields.find(f => f.key === 'due')!;
			const nextField = findNextField(line, dueField.valueStartPos);
			expect(nextField?.key).toBe('new field');
		});

		it('Tab from new field -> prio (wrap)', () => {
			const fields = getFieldPositions(line);
			const newField = fields.find(f => f.key === 'new field')!;
			const nextField = findNextField(line, newField.valueStartPos);
			expect(nextField?.key).toBe('prio');
		});

		it('Shift-Tab from new field -> due', () => {
			const fields = getFieldPositions(line);
			const newField = fields.find(f => f.key === 'new field')!;
			const prevField = findPrevField(line, newField.valueStartPos);
			expect(prevField?.key).toBe('due');
		});
	});

	describe('forward Tab through fields', () => {
		const line = '#todo [prio:: ] [due:: ] [status:: done]';

		it('Tab from prio -> due', () => {
			const fields = getFieldPositions(line);
			const prioField = fields.find(f => f.key === 'prio')!;
			const nextField = findNextField(line, prioField.valueStartPos);
			expect(nextField?.key).toBe('due');
		});

		it('Tab from due -> status', () => {
			const fields = getFieldPositions(line);
			const dueField = fields.find(f => f.key === 'due')!;
			const nextField = findNextField(line, dueField.valueStartPos);
			expect(nextField?.key).toBe('status');
		});

		it('Tab from status -> prio (wrap)', () => {
			const fields = getFieldPositions(line);
			const statusField = fields.find(f => f.key === 'status')!;
			const nextField = findNextField(line, statusField.valueStartPos);
			expect(nextField?.key).toBe('prio');
		});
	});

	describe('backward Shift-Tab through fields', () => {
		const line = '#todo [prio:: ] [due:: ] [status:: done]';

		it('Shift-Tab from status -> due', () => {
			const fields = getFieldPositions(line);
			const statusField = fields.find(f => f.key === 'status')!;
			const prevField = findPrevField(line, statusField.valueStartPos);
			expect(prevField?.key).toBe('due');
		});

		it('Shift-Tab from due -> prio', () => {
			const fields = getFieldPositions(line);
			const dueField = fields.find(f => f.key === 'due')!;
			const prevField = findPrevField(line, dueField.valueStartPos);
			expect(prevField?.key).toBe('prio');
		});

		it('Shift-Tab from prio -> status (wrap)', () => {
			const fields = getFieldPositions(line);
			const prioField = fields.find(f => f.key === 'prio')!;
			const prevField = findPrevField(line, prioField.valueStartPos);
			expect(prevField?.key).toBe('status');
		});
	});

	describe('Tab to next empty field (auto-advance)', () => {
		it('skips filled fields to find empty', () => {
			const line = '[done:: yes] [pending:: ] [other:: no]';
			const fields = getFieldPositions(line);
			const doneField = fields.find(f => f.key === 'done')!;
			const nextEmpty = findNextEmptyField(line, doneField.valueEndPos);
			expect(nextEmpty?.key).toBe('pending');
		});
	});
});

describe('position calculation accuracy', () => {
	// Critical for cursor positioning - verify exact positions

	it('calculates correct positions for standard field', () => {
		const line = '[key:: value]';
		// Positions: 0123456789...
		// [key:: value]
		// 0    5     12
		const fields = getFieldPositions(line);
		expect(fields[0]).toMatchObject({
			startPos: 0,      // [
			endPos: 13,       // after ]
			valueStartPos: 7, // v in value
			valueEndPos: 12,  // ] position
		});
	});

	it('calculates correct positions for empty field', () => {
		const line = '[key:: ]';
		// [key:: ]
		// 01234567
		const fields = getFieldPositions(line);
		expect(fields[0]).toMatchObject({
			startPos: 0,
			endPos: 8,
			valueStartPos: 7, // space before ]
			valueEndPos: 7,   // same as start for empty
		});
	});

	it('calculates correct positions with preceding text', () => {
		const line = 'prefix [key:: val]';
		// prefix [key:: val]
		// 0     67         17
		const fields = getFieldPositions(line);
		expect(fields[0]?.startPos).toBe(7);
		expect(fields[0]?.valueStartPos).toBe(14);
	});
});
