import * as zstd from "@bokuweb/zstd-wasm"

const threshold_ms = 200
const chunk_size = 100
const around_chars = 20

let current_query = null
let promise = Promise.resolve()
const { promise: loaded, resolve: resolveLoaded } = Promise.withResolvers()
let data = null

const search = async (query) => {
	const buf = []
	let time = Date.now()
	const gists = data.gists
	postMessage({ type: "search-start", query: query.raw })
	for (let i = 0; i < gists.length; i++) {
		if (i % chunk_size === 0) {
			const now = Date.now()
			const diff = now - time
			// キャンセル/結果返却ポイント
			if (diff > threshold_ms) {
				time = now
				await new Promise(r => setTimeout(r, 0))
				if (query == current_query) {
					if (buf.length) {
						postMessage({ type: "search", items: buf })
						buf.length = 0
					}
				} else {
					postMessage({ type: "search-cancel" })
					return
				}
			}
		}
		const matched = match(query, gists[i])
		if (matched) {
			buf.push(matched)
		}
	}
	postMessage({ type: "search-done", items: buf })
}

const match = (query, item) => {
	const matched = query.match(item[3])
	if (!matched) return
	const text = item[3].slice(
		Math.max(0, matched[0] - around_chars),
		matched[1] + around_chars,
	)
	return {
		gist_id: item[0],
		filename: item[1],
		created_at: item[2],
		body: text.split(query.highlighter),
	}
}

const createQuery = (raw_query) => {
	if (!raw_query.trim()) {
		return
	} else if (raw_query.startsWith("/") && raw_query.endsWith("/")) {
		const body = raw_query.slice(1, -1)
		const re = new RegExp(`(${body})`, "i")
		const match = (str) => {
			const result = str.match(re)
			return result ? [result.index, result.index + result[0].length] : null
		}
		return { match, highlighter: re, raw: raw_query }
	} else {
		const words = raw_query.split(/\s+/)
		const lower_words = words.map(x => x.toLowerCase())
		const match = (str) => {
			let min_index = Infinity
			let len = 0
			const lower_str = str.toLowerCase()
			for (const word of lower_words) {
				const index = lower_str.indexOf(word)
				if (index < 0) return null
				if (index < min_index) {
					min_index = index
					len = word.length
				}
			}
			return [min_index, min_index + len]
		}
		const body = words.map(RegExp.escape).join("|")
		const highlighter = new RegExp(`(${body})`, "i")
		return { match, highlighter, raw: raw_query }
	}
}

const searchNext = async (raw_query) => {
	if (!data) {
		await loaded
	}

	const query = createQuery(raw_query)

	// 前回の検索時の search が終わってなければキャンセルポイントで終わらせる
	current_query = query

	await promise

	if (query) {
		promise = search(query)
	} else {
		postMessage({ type: "clear" })
	}
}

// 読み込むデータの URL は固定じゃなくてページ側から受け取る
// 初期化用の message を受け取ったら実行
const load = async (url) => {
	postMessage({ type: "init" })
	const buf = await fetch(url).then(res => res.arrayBuffer())
	const ext = new URL(url).pathname.split(".").at(-1)
	if (ext === "zst") {
		await zstd.init()
		const str = new TextDecoder().decode(zstd.decompress(new Uint8Array(buf)))
		data = JSON.parse(str)
	} else {
		const str = new TextDecoder().decode(buf)
		data = JSON.parse(str)
	}
	postMessage({ type: "ready", length: data.gists.length, timestamp: data.timestamp })
}

addEventListener("message", async (event) => {
	if (event.data.load) {
		load(event.data.load).then(
			resolveLoaded,
			err => {
				postMessage({ type: "error", error: `Failed to load file: ${event.data.load}` })
				throw err
			},
		)
	} else if (event.data.query != null) {
		searchNext(event.data.query)
	}
})
