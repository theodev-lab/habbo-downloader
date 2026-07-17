#!/usr/bin/env node

process.noDeprecation = true

const argv = require('minimist')(process.argv.slice(2))
const fs = require('fs')
const path = require('path')
const package = require('../package.json')
const Logger = require('./logger')
const { initConfig, config, startStats, stopStats, createStats } = require('./functions')

const STANDARD_COMMANDS = ['articles', 'badgeparts', 'badges', 'clothes', 'effects', 'ficons', 'furnitures', 'gamedata', 'gordon', 'habboswf', 'hotelview', 'icons', 'mp3', 'pets', 'promo']

const UNITY_COMMANDS = ['clothes', 'effects', 'furnitures']

const logger = new Logger({ level: 'info' })

async function init() {
	logger.child('init').info('starting habbo-downloader %s', package.version)

	await initConfig(argv)
}

function getCommands() {
	const command = argv.c || argv.command
	const isUnity = argv.u || argv.unity

	if (!command) {
		const err = new Error('NO_COMMAND')
		err.code = 'NO_COMMAND'

		throw err
	}

	const commands = String(command)
		.split(',')
		.map((command) => command.trim())
		.filter(Boolean)

	if (commands.length === 1 && commands[0] === 'all') {
		return isUnity ? UNITY_COMMANDS : STANDARD_COMMANDS
	}

	return commands
}

function formatDuration(ms) {
	const seconds = ms / 1000

	if (seconds < 60) {
		return `${seconds.toFixed(1)}s`
	}

	const minutes = Math.floor(seconds / 60)
	const rest = (seconds % 60).toFixed(1).padStart(4, '0')

	return `${minutes}m ${rest}s`
}

function mergeStats(target, source) {
	target.total += source.total
	target.downloaded += source.downloaded
	target.skipped += source.skipped
	target.failed += source.failed
	target.errors.push(...source.errors)
}

function formatDateForFile(date) {
	return date.toISOString().replace(/[:.]/g, '-')
}

function formatCommandError(err) {
	if (!err) {
		return 'UNKNOWN_ERROR'
	}

	return err.code || 'COMMAND_ERROR'
}

async function runCommand(command, isUnity) {
	const startedAt = Date.now()
	const context = logger.child(command)

	startStats()

	try {
		const commandPath = isUnity ? `./command/unity/${command}` : `./command/${command}`
		await require(commandPath)()

		const stats = stopStats()
		const duration = formatDuration(Date.now() - startedAt)
		const level = stats.failed > 0 ? 'warn' : 'info'

		context[level]('finished downloaded=%d skipped=%d failed=%d duration=%s', stats.downloaded, stats.skipped, stats.failed, duration)

		return { command, failed: false, stats }
	} catch (err) {
		const stats = stopStats()
		const duration = formatDuration(Date.now() - startedAt)

		context.error('aborted downloaded=%d skipped=%d failed=%d duration=%s', stats.downloaded, stats.skipped, stats.failed, duration)

		return { command, failed: true, stats, error: err }
	}
}

async function writeErrorLog(results, totals) {
	const commandErrors = results.filter((result) => result.failed)

	if (totals.failed === 0 && commandErrors.length === 0) {
		return null
	}

	const finishedAt = new Date()
	const logDir = path.join(config.output, 'logs')
	const logFile = path.join(logDir, `errors-${formatDateForFile(finishedAt)}.log`)
	const lines = []
	const fileLogger = new Logger({ colorize: false, stdout: { write: (line) => lines.push(line.trimEnd()) }, stderr: { write: (line) => lines.push(line.trimEnd()) } })

	commandErrors.forEach((result) => {
		fileLogger.child(result.command).error('command failed (%s)', formatCommandError(result.error))
	})

	results.forEach((result) => {
		if (result.stats.errors.length === 0) {
			return
		}

		result.stats.errors.forEach((err) => {
			fileLogger.child(result.command).error('download failed %s %s', err.status || '-', err.src)
		})
	})

	await fs.promises.mkdir(logDir, { recursive: true })
	await fs.promises.writeFile(logFile, `${lines.join('\n')}\n`)
}

async function printSummary(results, startedAt) {
	const commandFailed = results.filter((result) => result.failed)
	const totals = createStats()

	results.forEach((result) => mergeStats(totals, result.stats))

	const duration = formatDuration(Date.now() - startedAt)
	await writeErrorLog(results, totals)

	process.stdout.write('\n')
	process.stdout.write(`Commands: ${results.length} total, ${results.length - commandFailed.length} succeeded, ${commandFailed.length} failed\n`)
	process.stdout.write(`Files: ${totals.total} total, ${totals.downloaded} downloaded, ${totals.skipped} skipped, ${totals.failed} failed\n`)
	process.stdout.write(`Duration: ${duration}\n`)
}

async function main() {
	const startedAt = Date.now()
	const results = []

	try {
		await init()

		const isUnity = argv.u || argv.unity
		const commands = getCommands()
		const requestedCommand = argv.c || argv.command
		const commandLabel = String(requestedCommand).includes(',') ? 'commands' : 'command'

		const configLog = [`${commandLabel}=${requestedCommand}`, `domain=${config.domain}`, `output=${config.output}`]

		if (commands.includes('badges')) {
			configLog.push(`format=${config.format}`)
		}

		logger.child('config').info(configLog.join(' '))

		for (const command of commands) {
			results.push(await runCommand(command, isUnity))
		}

		await printSummary(results, startedAt)

		if (results.some((result) => result.failed)) {
			process.exitCode = 1
		}
	} catch {
		process.exitCode = 1
	}
}

main()
