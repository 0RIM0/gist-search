import { parseArgs } from "node:util"

import { generate } from "./generate.js"
import { cli_options } from "./options.js"

const { values } = parseArgs({ options: cli_options })

const counts = {
	"file-cache": 0,
	"file-nocache": 0,
	gist: 0,
}

values.logger = {
	log: console.log,
	progress: (type) => {
		counts[type]++
		switch (type) {
			case "file-cache":
				process.stdout.write(",")
				break
			case "file-nocache":
				process.stdout.write(".")
				break
			case "gist":
				process.stdout.write(":")
				break
		}
	},
}

try {
	await generate(values)
} catch (err) {
	if (err.cause?.validation_errors) {
		console.log("log:")
		console.log(err.cause.validation_errors.map(x => "  - " + x).join("\n"))
		console.log("Usage:")
		console.log("  node cli.js -u <GITHUB_USERNAME> -o <OUTPUT_PATH> -c <CACHE_DIR_PATH>")
	} else {
		console.error(err)
	}
	process.exit(1)
}

console.log("done!")

// show stats
const cache = counts["file-cache"]
const nocache = counts["file-nocache"]
const gists = counts.gist
const files = cache + nocache
console.log(`${files} files (cache/nocache: ${cache}/${nocache}), ${gists} gists`)
