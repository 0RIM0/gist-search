import fs from "node:fs"
import path from "node:path"

export const createCache = (directory) => {
	return directory
		? async (key, register) => {
			const cache_file = path.join(directory, key)
			if (fs.existsSync(cache_file)) {
				return [await fs.promises.readFile(cache_file, "utf-8"), true]
			} else {
				const text = await register()
				await fs.promises.mkdir(path.dirname(cache_file), { recursive: true })
				await fs.promises.writeFile(cache_file, text)
				return [text, false]
			}
		}
		: async (key, register) => [await register(), false]
}

export const readFilePartial = async (filepath, start, end) => {
	const stream = fs.createReadStream(filepath, { start, end, encoding: "utf-8" })

	let result = ""
	for await (const chunk of stream) {
		result += chunk
	}
	return result
}
