import { readFileSync, writeFileSync } from "fs";

const targetVersion = process.env.npm_package_version;
if (!targetVersion) {
	console.error("npm_package_version is not set");
	process.exit(1);
}

// update manifest.json
const manifest = JSON.parse(readFileSync("manifest.json", "utf8"));
manifest.version = targetVersion;
writeFileSync("manifest.json", JSON.stringify(manifest, null, "\t") + "\n");

// update versions.json
let versions = {};
try {
	versions = JSON.parse(readFileSync("versions.json", "utf8"));
} catch (error) {
	// versions.json may not exist yet
}
versions[targetVersion] = manifest.minAppVersion;
writeFileSync("versions.json", JSON.stringify(versions, null, "\t") + "\n");

console.log(`Version bumped to ${targetVersion}`);
