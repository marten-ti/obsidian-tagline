export function addDays(date: Date, days: number): Date {
	const result = new Date(date);
	result.setDate(result.getDate() + days);
	return result;
}

export function addHours(date: Date, hours: number): Date {
	const result = new Date(date);
	result.setHours(result.getHours() + hours);
	return result;
}

export function formatDate(date: Date): string {
	return date.toISOString().split('T')[0] ?? '';
}

export function formatDatetime(date: Date): string {
	const pad = (n: number) => n.toString().padStart(2, '0');
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function roundToNextHour(date: Date): Date {
	const result = new Date(date);
	result.setMinutes(0, 0, 0);
	result.setHours(result.getHours() + 1);
	return result;
}
