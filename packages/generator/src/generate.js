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

import { getGists, getMarkdownFileText, getMetaJSON } from "./gist.js"
import { validateOptions } from "./options.js"
import { createCache, readFilePartial } from "./utils.js"

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

const getMetaSearchExclude = async (files) => {
	if (!files["_meta.json"]) return

	const { search_exclude } = await getMetaJSON(files["_meta.json"].raw_url)
	if (!search_exclude) return

	const valid = search_exclude === true || Array.isArray(search_exclude)
	if (!valid) return

	return search_exclude
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

			const excludes = options.exclude_files.filter(([exid]) => exid === id)
			// id のみでマッチする除外設定
			if (excludes.some(([, exfile]) => !exfile)) continue

			const meta_search_exclude = await getMetaSearchExclude(files)
			if (meta_search_exclude === true) continue

			const exclude_filnames = [
				...excludes.map(([, exfile]) => exfile).filter(x => x),
				...meta_search_exclude ?? [],
			]

			const timestamp = updated_at.replace(/[-\/_:]/g, "")

			for (const { filename, type, raw_url } of Object.values(files)) {
				if (exclude_filnames.some(exfilename => exfilename === filename)) continue

				if (type === "text/markdown") {
					const key = `${id}_${timestamp}/${filename}`
					let [text, cache_hit] = await cache(key, () => getMarkdownFileText(raw_url))

					// gist の description も本文に含める
					// 1 gist に複数の markdown ファイルがあると全てに含めることになるけど
					// 基本は 1 ファイルだけなので気にしない
					if (!text.startsWith(description)) {
						text = description + " " + text
					}
					if (text.length < options.min_text_length) continue

					yield { id, filename, created_at, text }
					options.logger.progress(cache_hit ? "file-cache" : "file-nocache")
				}
			}
			options.logger.progress("gist")
		}
	}
}

const generate = async (opts) => {
	const now = new Date()
	const [errors, options] = await validateOptions(opts)

	if (errors.length) {
		throw new Error("validation error", { cause: { validation_errors: errors } })
	}

	const logger = options.logger
	logger.log("options:", options)

	// キャッシュされた前回のデータから timestamp を取得
	const date = await getPreTimestamp(options.output)
	if (date instanceof Date) {
		if (now - date < options.skip_interval * 1000) {
			// 前回の作成から指定時間以内ならなにもしない
			// 前回の結果をそのままキャッシュにする
			logger.log(`skip generate! less than skip_interval (elapsed: ${now - date})`)
			return
		} else if (options.no_update_check) {
			logger.log("skip update check")
		} else {
			// update check は since 指定で前回以降の更新のみを一旦取得
			// 更新のある Gist が 0 件ならなにもしない
			// 内容の前回とのマージはできないので更新が必要かの判断のみ
			// 取得したものは捨てるので 1 件のみの取得
			logger.log("update check:", date)
			const { value } = await getGists({ user: options.user, per_page: 1, since: date.toJSON() }).next()
			if (value.length === 0) {
				logger.log("skip generate! no updates found")
				return
			}
		}
	} else {
		logger.log("prev timestamp not found:", date.error)
	}

	logger.log("start!")

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

	const { promise, resolve } = Promise.withResolvers()
	file.close(resolve)
	return promise
}

export { generate }
