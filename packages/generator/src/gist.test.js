import assert from "node:assert"
import { after, before, describe, it, mock } from "node:test"

import { getGists, getMarkdownFileText } from "./gist.js"

describe("getGists", () => {
	let res_arr = []
	let mockFetch = null

	before(() => {
		mockFetch = mock.method(globalThis, "fetch", () => res_arr.shift())
	})

	after(() => {
		mockFetch.mock.restore()
	})

	it("normal", async () => {
		res_arr = [
			{
				ok: true,
				headers: {
					get: (name) => {
						if (name === "link") {
							return `<https://one.example.com>; rel="last", <https://two.example.com>; rel="next", <https://three.example.com>; rel="prev"`
						}
					},
				},
				json: () => {
					return Promise.resolve({ value: "FIRST" })
				},
			},
			{
				ok: true,
				headers: {
					get: (name) => {
						if (name === "link") {
							return ""
						}
					},
				},
				json: () => {
					return Promise.resolve({ value: "SECOND" })
				},
			},
		]

		const result = await Array.fromAsync(getGists({ user: "foo", per_page: 50, since: null }))
		const expected = [
			{ value: "FIRST" },
			{ value: "SECOND" },
		]
		assert.deepStrictEqual(result, expected)

		assert.deepStrictEqual(mockFetch.mock.calls.map(x => x.arguments), [
			["https://api.github.com/users/foo/gists?per_page=50&since=&page=1"],
			["https://two.example.com/"],
		])
	})
})

describe("getMarkdownFileText", (t) => {
	let markdown = ""
	let mockFetch = null

	before(() => {
		mockFetch = mock.method(globalThis, "fetch", () => {
			return {
				ok: true,
				text: () => Promise.resolve(markdown),
			}
		})
	})

	after(() => {
		mockFetch.mock.restore()
	})

	it("markdown simple", async () => {
		markdown = " a b "
		const expected = `a b`
		assert.deepStrictEqual(await getMarkdownFileText(""), expected)
	})

	it("markdown complex", async () => {
		markdown = "# h1\n"
			+ "\n"
			+ "foo **bold** `code`\n"
			+ "```js\n"
			+ "const fn = () => {}\n"
			+ "```\n"
			+ "\n"
			+ "link: [URL](http://foo.bar/)  \n"
			+ "![img](http://example.com/)  \n"
			+ '<img src="img.png">  \n'
			+ "\n"
			+ "a     b"
		const expected = `h1 foo bold code const fn = () => {} link: URL a b`
		assert.deepStrictEqual(await getMarkdownFileText(""), expected)
	})
})
