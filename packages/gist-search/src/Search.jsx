import dayjs from "dayjs"
import { useEffect, useState } from "react"
import "./Search.css"
import { data_url, getInfo, getState, search, setCallback } from "./search.js"

const Search = ({ onChange }) => {
	const [ready, setReady] = useState(false)
	const [result_length, setResultLength] = useState(0)

	setCallback((state) => {
		setReady(!state.error)
		setResultLength(state.items?.length ?? 0)
		onChange(state)
	})

	// マウント時の初期状態で更新
	// 以降は setCallback で設定した関数がイベント時に呼び出される
	useEffect(() => {
		if (!data_url) {
			onChange({ error: "データ URL を指定してください" })
			return
		}
		const state = getState()
		if (state) {
			onChange(state)
		} else {
			onChange({ error: "データ読込中" })
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [])

	const _onChange = (event) => {
		const value = event.target.value
		if (value.startsWith("/") && value.endsWith("/")) {
			try {
				new RegExp(`(${value.slice(1, -1)})`)
			} catch {
				onChange({ error: "不正な正規表現です" })
				return
			}
		}
		search(value)
	}

	const info = getInfo()

	return (
		<div className="component-search component-root">
			<input autoFocus onChange={_onChange} disabled={!ready} />
			{info && (
				<div className="info">
					<span>{result_length}/{info.length}</span>
					<span>ver.{dayjs(info.timestamp).format("YYYYMMDD")}</span>
				</div>
			)}
		</div>
	)
}

export default Search
