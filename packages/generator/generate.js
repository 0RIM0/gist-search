// Gist データの作成
// {
//   timestamp: "timestamp string",
//   gists: [
//     [id, filename, created_at, text],
//     ...
//   ]
// }
// の json データを出力

import fs from "node:fs"
import path from "node:path"
import { parseArgs } from "node:util"

import { Window } from "happy-dom"
import markdownit from "markdown-it"

const md = markdownit()
const window = new Window({ url: "https://localhost:8080" })

const getGists = async function*({ user, per_page, since }) {
	const url_obj = new URL(`https://api.github.com/users/${user}/gists`)
	url_obj.searchParams.set("per_page", per_page ?? 100)
	url_obj.searchParams.set("since", since ?? "")
	url_obj.searchParams.set("page", 1)

	let url = url_obj.href

	while (url) {
		const res = await fetch(url)

		if (!res.ok) {
			throw new Error("failed to fetch gist: " + url)
		}
		yield await res.json()

		const urls = parseLink(res.headers.get("link") || "")
		url = urls.next?.href
	}
}

const getMarkdownFile = async (url) => {
	const res = await fetch(url)
	if (!res.ok) {
		throw new Error("failed to fetch markdown file: " + url)
	}
	const body = await res.text()
	const html = md.render(body)

	const document = window.document
	document.body.innerHTML = html
	return document.body.innerText.replace(/\s+/g, " ")
}

const parseLink = (link_header) => {
	const matches = [...link_header.matchAll(/<(https:\/\/.+?)>; rel="(.+?)"/g)]
	return Object.fromEntries(
		matches.map(([_, url, rel]) => {
			return [rel, new URL(url)]
		}),
	)
}

const createCache = (directory) => {
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

const readFilePartial = async (filepath, start, end) => {
	const stream = fs.createReadStream(filepath, { start, end, encoding: "utf-8" })

	let result = ""
	for await (const chunk of stream) {
		result += chunk
	}
	return result
}

const getPreTimestamp = async (filepath) => {
	if (!fs.existsSync(filepath)) {
		return { error: "file not found" }
	}
	const str = await readFilePartial(filepath, 0, 50)
	const matched = str.match(/"timestamp":"(.+?)"/)
	if (!matched) {
		return { error: "timestamp not found" }
	}
	const date = new Date(matched[1])
	// 桁間違いなどの異常な日付を弾くためなのでとりあえず 20 年
	const allow_range = 1000 * 60 * 60 * 24 * 365 * 20
	if (isNaN(date) || Math.abs(Date.now() - date) > allow_range) {
		return { error: "invalid date" }
	}
	return date
}

const validateOptions = ({ values }) => {
	const errors = []
	const options = {}

	if (!values.user) {
		errors.push("user is required")
	} else {
		options.user = values.user
	}

	const min_date = new Date(values["min-date"])
	if (isNaN(min_date)) {
		errors.push("min-date is invalid date")
	} else {
		options.min_date = min_date
	}

	const max_date = new Date(values["max-date"])
	if (isNaN(max_date)) {
		errors.push("max-date is invalid date")
	} else {
		options.max_date = max_date
	}

	if (isNaN(values["min-text-length"])) {
		errors.push("min-text-length is invalid number")
	} else {
		options.min_text_length = ~~values["min-text-length"]
	}

	if (isNaN(values["skip-interval"])) {
		errors.push("skip-interval is invalid number")
	} else {
		options.skip_interval = ~~values["skip-interval"]
	}

	if (isNaN(values["skip-interval"])) {
		errors.push("skip-interval is invalid number")
	} else {
		options.skip_interval = ~~values["skip-interval"]
	}

	options.output = values.output
	options.cache = values.cache
	options.no_update_check = values["no-update-check"]

	return [errors, options]
}

const getGistFiles = async function*(options) {
	const processed = new Set()
	const cache = createCache(options.cache)

	for await (const gists of getGists({ user: options.user })) {
		for (const { id, files, description, created_at, updated_at } of gists) {
			const date_created_at = new Date(created_at)
			if (date_created_at < options.min_date || options.max_date < date_created_at) continue

			// 自身のを取得するときは通常ないはずだけど途中で Gist が追加されると
			// 次のページに重複が出る可能性があるので一応重複判定とスキップ
			if (processed.has(id)) continue
			processed.add(id)

			const timestamp = updated_at.replace(/[-\/_:]/g, "")

			for (const { filename, type, raw_url } of Object.values(files)) {
				if (type === "text/markdown") {
					const key = `${id}_${timestamp}/${filename}`
					let [text, cache_hit] = await cache(key, () => getMarkdownFile(raw_url))

					// gist の description も本文に含める
					// 1 gist に複数の markdown ファイルがあると全てに含めることになるけど
					// 基本は 1 ファイルだけなので気にしない
					if (!text.startsWith(description)) {
						text = description + " " + text
					}
					if (text.length < options.min_text_length) continue

					yield { id, filename, created_at, text }
					options.notify?.(cache_hit ? "file-cache" : "file-nocache")
				}
			}
			options.notify?.("gist")
		}
	}
}

const main = async () => {
	const [errors, options] = validateOptions(
		parseArgs({
			options: {
				user: {
					type: "string",
					short: "u",
				},
				"min-date": {
					type: "string",
					default: "2018-01-01",
				},
				"max-date": {
					type: "string",
					default: "2099-12-31",
				},
				"min-text-length": {
					type: "string",
					default: "50",
				},
				output: {
					type: "string",
					short: "o",
					default: "gist-data.json",
				},
				cache: {
					type: "string",
					short: "c",
				},
				"skip-interval": {
					type: "string",
					default: String(60 * 60 * 24 * 1),
				},
				"no-update-check": {
					type: "boolean",
					default: false,
				},
			},
		}),
	)

	if (errors.length) {
		console.log("log:")
		console.log(errors.map(x => "  - " + x).join("\n"))
		console.log("Usage:")
		console.log("  node generate.js -u <GITHUB_USERNAME> -o <OUTPUT_PATH> -c <CACHE_DIR_PATH>")
		process.exitCode = 1
		return
	}

	console.log("options:", options)
	const now = new Date()

	// キャッシュされた前回のデータから timestamp を取得
	const date = await getPreTimestamp(options.output)
	if (date instanceof Date) {
		if (now - date < options.skip_interval * 1000) {
			// 前回の作成から指定時間以内ならなにもしない
			// 前回の結果をそのままキャッシュにする
			console.log("skip! elapsed:", now - date)
			return
		} else if (options.no_update_check) {
			console.log("no update check")
		} else {
			// update check は since 指定で前回以降の更新のみを一旦取得
			// 更新のある Gist が 0 件ならなにもしない
			// 内容の前回とのマージはできないので更新が必要かの判断のみ
			// 取得したものは捨てるので 1 件のみの取得
			console.log("update check:", date)
			const { value } = await getGists({ user: options.user, per_page: 1, since: date.toJSON() }).next()
			if (value.length === 0) {
				console.log("no updates")
				return
			}
		}
	} else {
		console.log("prev timestamp not found:", date.error)
	}

	console.log("start!")

	const counts = {
		"file-cache": 0,
		"file-no-cache": 0,
		gist: 0,
	}
	options.notify = (type) => {
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
	}

	// json format: { timestamp: "2025-01-01T00:00:00Z", gists: [[], [], ...] }
	const file = fs.createWriteStream(options.output)
	file.write(`{"timestamp":"${now.toJSON()}","gists":[`)

	let index = 0

	for await (const { id, filename, created_at, text } of getGistFiles(options)) {
		if (index !== 0) {
			file.write(",")
		}

		file.write(JSON.stringify([id, filename, created_at, text]))
		index++
	}

	file.write(`]}`)
	file.close(() => {
		console.log("done!")

		// show stats
		const cache = counts["file-cache"]
		const nocache = counts["file-no-cache"]
		const gists = counts.gist
		const files = cache + nocache
		console.log(`${files} files (cache/nocache: ${cache}/${nocache}), ${gists} gists`)
	})
}

main()
