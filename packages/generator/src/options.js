export const cli_options = {
	user: {
		type: "string",
		short: "u",
	},
	"min-date": {
		type: "string",
		default: "2018-01-01",
	},
	"max-date": {
		type: "string",
		default: "2099-12-31",
	},
	"min-text-length": {
		type: "string",
		default: "50",
	},
	output: {
		type: "string",
		short: "o",
		default: "gist-data.json",
	},
	cache: {
		type: "string",
		short: "c",
	},
	"skip-interval": {
		type: "string",
		default: String(60 * 60 * 24 * 1),
	},
	"no-update-check": {
		type: "boolean",
		default: false,
	},
}

export const validateOptions = (values) => {
	const errors = []
	const options = {}

	if (!values.user) {
		errors.push("user is required")
	} else {
		options.user = values.user
	}

	const min_date = new Date(values["min-date"])
	if (isNaN(min_date)) {
		errors.push("min-date is invalid date")
	} else {
		options.min_date = min_date
	}

	const max_date = new Date(values["max-date"])
	if (isNaN(max_date)) {
		errors.push("max-date is invalid date")
	} else {
		options.max_date = max_date
	}

	if (isNaN(values["min-text-length"])) {
		errors.push("min-text-length is invalid number")
	} else {
		options.min_text_length = ~~values["min-text-length"]
	}

	if (isNaN(values["skip-interval"])) {
		errors.push("skip-interval is invalid number")
	} else {
		options.skip_interval = ~~values["skip-interval"]
	}

	options.output = values.output
	options.cache = values.cache
	options.no_update_check = values["no-update-check"]
	options.logger = values.logger ?? {
		log: () => {},
		progress: () => {},
	}

	return [errors, options]
}
