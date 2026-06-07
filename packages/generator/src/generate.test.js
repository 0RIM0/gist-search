import assert from "node:assert"
import fs from "node:fs"
import path from "node:path"
import { afterEach, beforeEach, describe, it, mock } from "node:test"
import { setupTmpdir, teardownTmpdir, tmpdir } from "./test-util.js"

const mdfiles = {
	"/1": "001-text",
	"/2": "002-text",
	"/3": "003-text",
	"/4": "4",
	"/5": "005-text",
}

const getGists = mock.fn(() => {})
const getMarkdownFileText = mock.fn((url) => mdfiles[new URL(url).pathname])

mock.module("./gist.js", {
	namedExports: {
		getGists,
		getMarkdownFileText,
	},
})

const { generate } = await import("./generate.js")

describe("generate", () => {
	const date_now = new Date("2026-06-02T00:00:00Z")
	const date_old = new Date("2026-06-01T00:00:00Z")
	
	beforeEach(async () => {
		await setupTmpdir()
	})

	afterEach(async () => {
		await teardownTmpdir()
	})

	it("生成時", async (t) => {
		const logger = {
			log: mock.fn(() => {}),
			progress: mock.fn(() => {}),
		}
		t.mock.timers.enable({
			apis: ["Date"],
			now: date_now,
		})
		getGists.mock.resetCalls()
		getGists.mock.mockImplementationOnce(async function*() {
			yield [
				{
					id: "10",
					files: {
						"01.md": {
							filename: "01.md",
							type: "text/markdown",
							raw_url: "https://example.com/1",
						},
					},
					description: "A",
					created_at: "2025-01-01T00:00:00Z", // 日付対象外
					updated_at: "2026-06-01T00:00:00Z",
				},
				{
					id: "11",
					files: {
						"02.md": {
							filename: "02.md",
							type: "text/markdown",
							raw_url: "https://example.com/2",
						},
						"03.txt": {
							filename: "03.txt",
							type: "text/plain", // ファイル種別対象外
							raw_url: "https://example.com/3",
						},
						"04.md": {
							filename: "04.md",
							type: "text/markdown",
							raw_url: "https://example.com/4", // 文字数対象外
						},
					},
					description: "B",
					created_at: "2026-06-01T00:00:00Z",
					updated_at: "2026-06-01T00:00:00Z",
				},
			]
			yield [
				{
					id: "12",
					files: {
						"05.md": {
							filename: "05.md",
							type: "text/markdown",
							raw_url: "https://example.com/5",
						},
					},
					description: "C",
					created_at: "2026-06-02T00:00:00Z",
					updated_at: "2026-06-20T00:00:00Z",
				},
			]
		})
		const filepath = path.join(tmpdir, "output")
		await generate({
			user: "foo",
			"min-date": "2026-06-01",
			"max-date": "2026-06-03",
			"min-text-length": "5",
			"skip-interval": "0",
			output: filepath,
			logger,
		})
		assert.ok(
			logger.log.mock.calls.some(call => {
				return call.arguments[0].includes("prev timestamp not found")
			}),
			"output がないときのメッセージ",
		)
		assert.strictEqual(
			await fs.promises.readFile(filepath, "utf-8"),
			JSON.stringify({
				timestamp: date_now,
				gists: [
					["11", "02.md", "2026-06-01T00:00:00Z", "B 002-text"],
					["12", "05.md", "2026-06-02T00:00:00Z", "C 005-text"],
				],
			}),
			"作成されたファイル",
		)
	})

	it("no update check", async (t) => {
		const logger = {
			log: mock.fn(() => {}),
			progress: mock.fn(() => {}),
		}
		t.mock.timers.enable({
			apis: ["Date"],
			now: date_now,
		})
		getGists.mock.resetCalls()
		getGists.mock.mockImplementationOnce(async function*() {
			yield [
				{
					id: "12",
					files: {
						"05.md": {
							filename: "05.md",
							type: "text/markdown",
							raw_url: "https://example.com/5",
						},
					},
					description: "C",
					created_at: "2026-06-02T00:00:00Z",
					updated_at: "2026-06-20T00:00:00Z",
				},
			]
		})
		const filepath = path.join(tmpdir, "output")
		const content = `{"timestamp":"${date_old.toJSON()}",`
		await fs.promises.writeFile(filepath, content)
		await generate({
			user: "foo",
			"min-date": "2026-06-01",
			"max-date": "2026-06-03",
			"min-text-length": "5",
			"skip-interval": "0",
			output: filepath,
			logger,
			"no-update-check": true,
		})
		assert.ok(
			logger.log.mock.calls.some(call => {
				return call.arguments[0].includes("skip update check")
			}),
			"update チェックスキップのログ",
		)
		assert.strictEqual(
			await fs.promises.readFile(filepath, "utf-8"),
			JSON.stringify({
				timestamp: date_now,
				gists: [
					["12", "05.md", "2026-06-02T00:00:00Z", "C 005-text"],
				],
			}),
			"作成されたファイル",
		)
	})

	it("指定時間未満", async () => {
		const logger = {
			log: mock.fn(() => {}),
			progress: mock.fn(() => {}),
		}
		const filepath = path.join(tmpdir, "output")
		const content = `{"timestamp":"${date_old.toJSON()}",`
		await fs.promises.writeFile(filepath, content)
		await generate({
			user: "foo",
			"min-date": "2020-01-01",
			"max-date": "2099-01-01",
			"min-text-length": "10",
			"skip-interval": "10000000000",
			output: filepath,
			logger,
		})
		assert.ok(
			logger.log.mock.calls.some(call => {
				return call.arguments[0].includes("skip generate! less than skip_interval")
			}),
			"スキップ時のメッセージ出力",
		)
		assert.strictEqual(
			await fs.promises.readFile(filepath, "utf-8"),
			content,
			"ファイルに変化なし",
		)
	})

	it("更新なし", async () => {
		getGists.mock.resetCalls()
		getGists.mock.mockImplementationOnce(async function*() {
			yield []
		})
		const logger = {
			log: mock.fn(() => {}),
			progress: mock.fn(() => {}),
		}
		const filepath = path.join(tmpdir, "output")
		const content = `{"timestamp":"${date_old.toJSON()}",`
		await fs.promises.writeFile(filepath, content)
		await generate({
			user: "foo",
			"min-date": "2020-01-01",
			"max-date": "2099-01-01",
			"min-text-length": "10",
			"skip-interval": "0",
			output: filepath,
			logger,
		})
		assert.strictEqual(
			getGists.mock.callCount(),
			1,
			"getGists は update チェックの 1 回だけ呼び出し",
		)
		assert.ok(
			logger.log.mock.calls.some(call => {
				return call.arguments[0] === "skip generate! no updates found"
			}),
			"スキップ時のメッセージ出力",
		)
		assert.strictEqual(
			await fs.promises.readFile(filepath, "utf-8"),
			content,
			"ファイルに変化なし",
		)
	})
})
