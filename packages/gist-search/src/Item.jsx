import dayjs from "dayjs"
import React from "react"
import "./Item.css"

const Item = React.memo(({ item }) => {
	const body = item.body.reduce((acc, value, index) => {
		// 文字列を↓のように分割したものが入ってる
		// [マッチしない部分, マッチする部分, マッチしない部分, ...]
		const elem = index % 2 === 0 ? value : <mark key={index}>{value}</mark>
		return [...acc, elem]
	}, [])

	const url = `https://gist.github.com/${item.gist_id}#${getHash(item.filename)}`

	return (
		<a href={url} target="_blank" className="component--root component-item">
			<div className="head">
				<span className="gist-id">{item.gist_id}</span>
				<span className="filename">{item.filename}</span>
				<span className="created-at">{dayjs(item.created_at).format("YYYY/MM/DD")}</span>
			</div>
			<div className="body">
				{body}
			</div>
		</a>
	)
})

// Gist の各ファイルにジャンプするための hash を作る
// `file-` プレフィックスをつけて英数と `_` 以外は `-` に置き換え
// `-` は連続しない
const getHash = (filename) => {
	return ("file-" + filename.replace(/[^a-zA-Z0-9_]/g, "-")).replace(/-+/g, "-")
}

export default Item
