import assert from "node:assert"
import fs from "node:fs"
import path from "node:path"
import { afterEach, beforeEach, describe, it } from "node:test"

import { validateOptions } from "./options.js"
import { setupTmpdir, teardownTmpdir, tmpdir } from "./test-util.js"

describe("validateOptions", () => {
	it("成功時", async () => {
		const logger = {}
		assert.deepStrictEqual(
			await validateOptions({
				user: "username",
				"min-date": "2020-01-01",
				"max-date": "2099-12-31",
				"min-text-length": "100",
				"skip-interval": "1000",
				output: "output",
				cache: "cache",
				"no-update-check": true,
				"exclude-file": ["AAA", "BBB/CCC", "D/E/F"],
				logger,
			}),
			[
				[],
				{
					user: "username",
					min_date: new Date(2020, 0, 1),
					max_date: new Date(2099, 11, 31),
					min_text_length: 100,
					skip_interval: 1000,
					output: "output",
					cache: "cache",
					no_update_check: true,
					exclude_files: [["AAA", undefined], ["BBB", "CCC"], ["D", "E"]],
					logger,
				},
			],
		)
	})

	it("失敗時", async () => {
		const logger = {}
		assert.deepStrictEqual(
			await validateOptions({
				"min-date": "aaa",
				"max-date": "aaa",
				"min-text-length": "aaa",
				"skip-interval": "aaa",
				logger,
			}),
			[
				[
					"user is required",
					"min-date is invalid date",
					"max-date is invalid date",
					"min-text-length is invalid number",
					"skip-interval is invalid number",
				],
				{
					output: "",
					cache: "",
					no_update_check: false,
					exclude_files: [],
					logger,
				},
			],
		)
	})

	describe("config", async () => {
		beforeEach(async () => {
			await setupTmpdir()
		})

		afterEach(async () => {
			await teardownTmpdir()
		})

		it("configのみ", async () => {
			const filepath = path.join(tmpdir, "config.json")
			await fs.promises.writeFile(
				filepath,
				JSON.stringify({
					user: "username",
					"min-date": "2020-01-01",
					"max-date": "2099-12-31",
					"min-text-length": "100",
					"skip-interval": "1000",
					output: "output",
					cache: "cache",
					"no-update-check": true,
					"exclude-file": ["AAA", "BBB/CCC", "D/E/F"],
				}),
			)

			const logger = {}
			assert.deepStrictEqual(
				await validateOptions({
					"config": filepath,
					logger,
				}),
				[
					[],
					{
						user: "username",
						min_date: new Date(2020, 0, 1),
						max_date: new Date(2099, 11, 31),
						min_text_length: 100,
						skip_interval: 1000,
						output: "output",
						cache: "cache",
						no_update_check: true,
						exclude_files: [["AAA", undefined], ["BBB", "CCC"], ["D", "E"]],
						logger,
					},
				],
			)
		})

		it("configとマージ", async () => {
			const filepath = path.join(tmpdir, "config.json")
			await fs.promises.writeFile(
				filepath,
				JSON.stringify({
					user: "username1",
					"min-date": "2020-01-01",
					"skip-interval": "1000",
					output: "output",
					cache: "cache",
					"exclude-file": ["AAA", "BBB/CCC", "D/E/F"],
				}),
			)

			const logger = {}
			assert.deepStrictEqual(
				await validateOptions({
					"config": filepath,
					user: "username2",
					"max-date": "2099-12-31",
					"skip-interval": "2000",
					"no-update-check": true,
					"exclude-file": ["XXX/YYY", "ZZZ"],
					logger,
				}),
				[
					[
						"min-text-length is invalid number",
					],
					{
						user: "username2",
						min_date: new Date(2020, 0, 1),
						max_date: new Date(2099, 11, 31),
						skip_interval: 2000,
						output: "output",
						cache: "cache",
						no_update_check: true,
						exclude_files: [["XXX", "YYY"], ["ZZZ", undefined]],
						logger,
					},
				],
			)
		})
	})
})
