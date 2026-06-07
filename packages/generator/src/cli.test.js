import assert from "node:assert"
import { afterEach, beforeEach, describe, it, mock } from "node:test"
import { setTimeout } from "node:timers/promises"

const mockGenerate = mock.fn(() => "Default")

mock.module("./generate.js", {
	namedExports: {
		generate: mockGenerate,
	},
})

const stdoutOrg = process.stdout.write.bind(process.stdout)
const mockStdoutImpl = (value) => {
	// Buffer はテストランナーの内部処理のものなので本来の処理を呼び出し
	if (value instanceof Buffer) {
		stdoutOrg(value)
	}
}

describe("cli", () => {
	it("成功：更新あり", async (t) => {
		process.argv = ["node", "cli.js", "-u", "username", "--exclude-file", "A", "--exclude-file", "B"]
		mockGenerate.mock.mockImplementation(async (options) => {
			await setTimeout(10)
			options.logger.log("A")
			await setTimeout(10)
			options.logger.progress("file-cache")
			await setTimeout(10)
			options.logger.progress("file-cache")
			await setTimeout(10)
			options.logger.progress("file-nocache")
			await setTimeout(10)
			options.logger.progress("gist")
			await setTimeout(10)
			options.logger.log("B")
		})
		const mockLog = t.mock.method(console, "log", () => {})
		const mockStdout = t.mock.method(process.stdout, "write", mockStdoutImpl)
		await import("./cli.js?t=1")

		// prototype の違いで deep equal が false になるので通常オブジェクトに展開
		const generate_arg = { ...mockGenerate.mock.calls[0].arguments[0] }
		assert.deepStrictEqual(generate_arg, {
			user: "username",
			"max-date": "2099-12-31",
			"min-date": "2018-01-01",
			"min-text-length": "50",
			"no-update-check": false,
			"skip-interval": "86400",
			"exclude-file": ["A", "B"],
			logger: generate_arg.logger,
			output: "gist-data.json",
		})
		assert.deepStrictEqual(mockLog.mock.calls.map(x => x.arguments), [
			["A"],
			["B"],
			["done!"],
			["3 files (cache/nocache: 2/1), 1 gists"],
		])
		assert.deepStrictEqual(
			mockStdout.mock.calls.map(x => x.arguments).filter(x => !(x[0] instanceof Buffer)),
			[
				[","],
				[","],
				["."],
				[":"],
			],
		)
	})

	it("成功：更新なし", async (t) => {
		process.argv = ["node", "cli.js"]
		mockGenerate.mock.mockImplementation(async (options) => {
			options.logger.log("skip")
		})
		const mockLog = t.mock.method(console, "log", () => {})
		const mockStdout = t.mock.method(process.stdout, "write", mockStdoutImpl)
		await import("./cli.js?t=2")

		assert.deepStrictEqual(mockLog.mock.calls.map(x => x.arguments), [
			["skip"],
			["done!"],
			["0 files (cache/nocache: 0/0), 0 gists"],
		])
	})

	it("バリデーションエラー", async (t) => {
		process.argv = ["node", "cli.js"]
		mockGenerate.mock.mockImplementation(() => {
			throw new Error("validation error", {
				cause: { validation_errors: ["errrr"] },
			})
		})
		const mockLog = t.mock.method(console, "log", () => {})
		const mockStdout = t.mock.method(process.stdout, "write", mockStdoutImpl)
		const mockExit = t.mock.method(process, "exit", () => {})
		await import("./cli.js?t=3")

		// exit をモックしていて続行されるので本来実行される場所まで
		assert.deepStrictEqual(mockLog.mock.calls.slice(0, 4).map(x => x.arguments), [
			["log:"],
			["  - errrr"],
			["Usage:"],
			["  node cli.js -u <GITHUB_USERNAME> -o <OUTPUT_PATH> -c <CACHE_DIR_PATH>"],
		])
		assert.strictEqual(mockExit.mock.callCount(), 1)
		assert.strictEqual(mockExit.mock.calls[0].arguments[0], 1)
	})
})
