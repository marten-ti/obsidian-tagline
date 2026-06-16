// Minimal stub of the `obsidian` module for unit tests. Only includes the
// classes/types exercised by code under test.

export class TFile {
	path = '';
	basename = '';
	extension = '';
}

export class TFolder {
	path = '';
	children: unknown[] = [];
}

export class TAbstractFile {
	path = '';
}

export type App = unknown;
