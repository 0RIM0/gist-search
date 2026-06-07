import { Window } from "happy-dom"
import markdownit from "markdown-it"

const md = markdownit({ html: true })
const window = new Window({ url: "https://localhost:8080" })

export const getGists = async function*({ user, per_page, since }) {
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

const parseLink = (link_header) => {
	const matches = [...link_header.matchAll(/<(https:\/\/.+?)>; rel="(.+?)"/g)]
	return Object.fromEntries(
		matches.map(([_, url, rel]) => {
			return [rel, new URL(url)]
		}),
	)
}

export const getMarkdownFileText = async (url) => {
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

export const getMetaJSON = async (url) => {
	const res = await fetch(url)
	if (!res.ok) {
		throw new Error("failed to fetch meta-json file: " + url)
	}
	try {
		return await res.json()
	} catch {
		throw new Error("invalid json file: " + url)
	}
}
