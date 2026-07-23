import esbuild from "esbuild";
import process from "process";

const prod = process.argv[2] === "production";

await esbuild.build({
	entryPoints: ["main.ts"],
	bundle: true,
	external: ["obsidian", "@codemirror/state", "@codemirror/view"],
	format: "cjs",
	target: "es2020",
	logLevel: "info",
	sourcemap: prod ? false : "inline",
	treeShaking: true,
	outfile: "main.js",
});
