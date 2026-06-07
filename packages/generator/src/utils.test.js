import assert from "node:assert"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { afterEach, beforeEach, describe, it } from "node:test"
import { setTimeout } from "node:timers/promises"

import { setupTmpdir, teardownTmpdir, tmpdir } from "./test-util.js"
import { createCache, readFilePartial } from "./utils.js"

describe("createCache", () => {
	beforeEach(async () => {
		await setupTmpdir()
	})

	afterEach(async () => {
		await teardownTmpdir()
	})

	it("キャッシュ有効時", async () => {
		const cache = createCache(tmpdir)

		{
			const [text, use_cache] = await cache("foo", async () => {
				return await setTimeout(1, "abc")
			})
			assert.strictEqual(text, "abc")
			assert.strictEqual(use_cache, false)
		}
		{
			const [text, use_cache] = await cache("foo", async () => {
				return await setTimeout(1, "abc")
			})
			assert.strictEqual(text, "abc")
			assert.strictEqual(use_cache, true)
		}
		{
			const [text, use_cache] = await cache("bar", async () => {
				return await setTimeout(1, "def")
			})
			assert.strictEqual(text, "def")
			assert.strictEqual(use_cache, false)
		}
	})

	it("キャッシュ無効時", async () => {
		const cache = createCache()

		{
			const [text, use_cache] = await cache("foo", async () => {
				return await setTimeout(1, "abc")
			})
			assert.strictEqual(text, "abc")
			assert.strictEqual(use_cache, false)
		}
		{
			const [text, use_cache] = await cache("foo", async () => {
				return await setTimeout(1, "abc")
			})
			assert.strictEqual(text, "abc")
			assert.strictEqual(use_cache, false)
		}
	})
})

describe("readFilePartial", () => {
	beforeEach(async () => {
		await setupTmpdir()
	})

	afterEach(async () => {
		await teardownTmpdir()
	})

	it("read", async () => {
		const filepath = path.join(tmpdir, "01")
		await fs.promises.writeFile(filepath, "ABCDEFGHIJKLM")
		const text = await readFilePartial(filepath, 4, 8)
		assert.strictEqual(text, "EFGHI")
	})
})
