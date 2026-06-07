import assert from "node:assert"
import { afterEach, beforeEach, describe, it } from "node:test"

import { validateOptions } from "./options.js"

describe("validateOptions", () => {
	it("成功時", () => {
		const logger = {}
		assert.deepStrictEqual(
			validateOptions({
				user: "username",
				"min-date": "2020-01-01",
				"max-date": "2099-12-31",
				"min-text-length": "100",
				"skip-interval": "1000",
				output: "output",
				cache: "cache",
				"no-update-check": true,
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
					logger,
				},
			],
		)
	})

	it("失敗時", () => {
		const logger = {}
		assert.deepStrictEqual(
			validateOptions({
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
					output: undefined,
					cache: undefined,
					no_update_check: undefined,
					logger,
				},
			],
		)
	})
})
