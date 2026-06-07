import fs from "node:fs"
import os from "node:os"
import path from "node:path"

export const tmpdir = path.join(os.tmpdir(), crypto.randomUUID())

export const setupTmpdir = async () => {
	if (fs.existsSync(tmpdir)) {
		throw new Error("tmpdir already exists")
	}
	await fs.promises.mkdir(tmpdir)
}

export const teardownTmpdir = async () => {
	await fs.promises.rm(tmpdir, { recursive: true, force: true })
}
