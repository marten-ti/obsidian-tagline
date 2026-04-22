import { describe, it, expect } from 'vitest';
import { addDays, addHours, formatDate, formatDatetime, roundToNextHour } from './dateHelpers';

describe('dateHelpers', () => {
	describe('addDays', () => {
		it('should add positive days', () => {
			const date = new Date('2026-04-22T10:00:00');
			const result = addDays(date, 3);
			expect(result.getDate()).toBe(25);
		});

		it('should handle month boundary', () => {
			const date = new Date('2026-04-30T10:00:00');
			const result = addDays(date, 2);
			expect(result.getMonth()).toBe(4); // May
			expect(result.getDate()).toBe(2);
		});

		it('should not mutate original date', () => {
			const date = new Date('2026-04-22T10:00:00');
			addDays(date, 5);
			expect(date.getDate()).toBe(22);
		});

		it('should handle negative days', () => {
			const date = new Date('2026-04-22T10:00:00');
			const result = addDays(date, -5);
			expect(result.getDate()).toBe(17);
		});
	});

	describe('addHours', () => {
		it('should add positive hours', () => {
			const date = new Date('2026-04-22T10:00:00');
			const result = addHours(date, 3);
			expect(result.getHours()).toBe(13);
		});

		it('should handle day boundary', () => {
			const date = new Date('2026-04-22T22:00:00');
			const result = addHours(date, 5);
			expect(result.getDate()).toBe(23);
			expect(result.getHours()).toBe(3);
		});

		it('should not mutate original date', () => {
			const date = new Date('2026-04-22T10:00:00');
			addHours(date, 5);
			expect(date.getHours()).toBe(10);
		});
	});

	describe('formatDate', () => {
		it('should format date as YYYY-MM-DD', () => {
			const date = new Date('2026-04-22T10:00:00Z');
			expect(formatDate(date)).toBe('2026-04-22');
		});

		it('should pad single digit months and days', () => {
			const date = new Date('2026-01-05T10:00:00Z');
			expect(formatDate(date)).toBe('2026-01-05');
		});
	});

	describe('formatDatetime', () => {
		it('should format datetime as YYYY-MM-DDTHH:MM', () => {
			const date = new Date(2026, 3, 22, 14, 30); // April 22, 2026 14:30
			expect(formatDatetime(date)).toBe('2026-04-22T14:30');
		});

		it('should pad single digit values', () => {
			const date = new Date(2026, 0, 5, 9, 5); // January 5, 2026 09:05
			expect(formatDatetime(date)).toBe('2026-01-05T09:05');
		});
	});

	describe('roundToNextHour', () => {
		it('should round up to next hour', () => {
			const date = new Date(2026, 3, 22, 14, 30, 45);
			const result = roundToNextHour(date);
			expect(result.getHours()).toBe(15);
			expect(result.getMinutes()).toBe(0);
			expect(result.getSeconds()).toBe(0);
		});

		it('should handle exact hour', () => {
			const date = new Date(2026, 3, 22, 14, 0, 0);
			const result = roundToNextHour(date);
			expect(result.getHours()).toBe(15);
		});

		it('should not mutate original date', () => {
			const date = new Date(2026, 3, 22, 14, 30);
			roundToNextHour(date);
			expect(date.getMinutes()).toBe(30);
		});
	});
});
