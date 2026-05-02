import createWorker from "./search-worker.js?worker"

const worker = createWorker()
export const data_url = new URL(location).searchParams.get("data") ?? ""
if (data_url) {
	worker.postMessage({ load: data_url })
}

let state = null
let info = null
let current_callback = null

worker.addEventListener("message", (event) => {
	console.debug(new Date(), "worker message", event.data)
	switch (event.data.type) {
		case "ready":
			{
				info = { length: event.data.length, timestamp: new Date(event.data.timestamp) }
				state = { query: "", items: [], loading: false }
				current_callback?.(state)
			}
			break
		case "search-start":
			{
				state = { query: event.data.query, items: [], loading: true }
				current_callback?.(state)
			}
			break
		case "search-cancel":
			// キャンセルが起きる場合は直後に search-start か clear が起きるので
			// 更新処理は不要
			break
		case "search":
			{
				state = { query: state.query, items: [...state.items, ...event.data.items], loading: true }
				current_callback?.(state)
			}
			break
		case "search-done":
			{
				state = { query: state.query, items: [...state.items, ...event.data.items], loading: false }
				current_callback?.(state)
			}
			break
		case "clear":
			{
				state = { query: "", items: [], loading: false }
				current_callback?.(state)
			}
			break
		case "error":
			{
				current_callback?.(event.data)
			}
			break
	}
})

const debounce = (fn) => {
	let tid = null
	let last = 0
	const delay = 400
	const max_delay = 800

	return (...args) => {
		const now = Date.now()
		const diff = now - last
		clearTimeout(tid)
		const run = () => {
			last = Date.now()
			fn(...args)
		}
		if (max_delay < diff) {
			run()
		} else {
			tid = setTimeout(run, delay)
		}
	}
}

export const setCallback = (callback) => current_callback = callback

export const search = debounce((query) => worker.postMessage({ query }))

export const getState = () => state

export const getInfo = () => info
