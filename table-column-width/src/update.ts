export function compareVersions(v1: string, v2: string): number {
	const parseVersion = (version: string): number[] =>
		version
			.replace(/^v/, "")
			.split(/[+-]/, 1)[0]
			.split(".")
			.map((part) => {
				const match = /^\d+/.exec(part);
				return match ? parseInt(match[0], 10) : 0;
			});

	const parts1 = parseVersion(v1);
	const parts2 = parseVersion(v2);
	for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
		const difference = (parts1[i] ?? 0) - (parts2[i] ?? 0);
		if (difference !== 0) return difference;
	}
	return 0;
}
