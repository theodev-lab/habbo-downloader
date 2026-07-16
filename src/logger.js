const util = require('util')

const LogLevel = Object.freeze({
  SILLY: 0,
  TRACE: 1,
  DEBUG: 2,
  INFO: 3,
  WARN: 4,
  ERROR: 5,
  FATAL: 6,
})

const levelNames = Object.keys(LogLevel)

const colors = Object.freeze({
  SILLY: '\u001b[37m',
  TRACE: '\u001b[37m',
  DEBUG: '\u001b[32m',
  INFO: '\u001b[36m',
  WARN: '\u001b[33m',
  ERROR: '\u001b[31m',
  FATAL: '\u001b[91m',
})

const reset = '\u001b[0m'

function normalizeLevel (level) {
  if (typeof level === 'number') {
    const match = levelNames.find((name) => LogLevel[name] === level)
    if (match) return match
  }

  if (typeof level === 'string') {
    const name = level.toUpperCase()
    if (Object.prototype.hasOwnProperty.call(LogLevel, name)) return name
  }

  throw new Error(`Unknown log level: ${level}`)
}

function timestamp () {
  const now = new Date()
  const date = now.toISOString().replace('T', ' ').replace('Z', '')

  return date
}

function time () {
  const now = new Date()

  return now.toISOString().slice(11, 23)
}

function formatValue (value) {
  if (value instanceof Error) {
    return value.stack || value.message
  }

  if (typeof value === 'string') {
    return value
  }

  return util.inspect(value, {
    colors: false,
    depth: null,
    breakLength: Infinity,
  })
}

class Logger {
  constructor (options = {}) {
    this.level = LogLevel[normalizeLevel(options.level || 'silly')]
    this.context = options.context || null
    this.colorize = options.colorize !== false
    this.stdout = options.stdout || process.stdout
    this.stderr = options.stderr || process.stderr
    this.showTimestamp = options.showTimestamp !== false
    this.timestampFormat = options.timestampFormat || 'datetime'
  }

  silly (...args) {
    this.log('silly', ...args)
  }

  trace (...args) {
    this.log('trace', ...args)
  }

  debug (...args) {
    this.log('debug', ...args)
  }

  info (...args) {
    this.log('info', ...args)
  }

  warn (...args) {
    this.log('warn', ...args)
  }

  error (...args) {
    this.log('error', ...args)
  }

  fatal (...args) {
    this.log('fatal', ...args)
  }

  child (context) {
    return new Logger({
      level: this.level,
      context,
      colorize: this.colorize,
      stdout: this.stdout,
      stderr: this.stderr,
      showTimestamp: this.showTimestamp,
      timestampFormat: this.timestampFormat,
    })
  }

  log (level, ...args) {
    const name = normalizeLevel(level)

    if (LogLevel[name] < this.level) {
      return
    }

    const line = this.format(name, args)
    const stream = LogLevel[name] >= LogLevel.ERROR ? this.stderr : this.stdout

    stream.write(`${line}\n`)
  }

  format (name, args) {
    const parts = []

    if (this.showTimestamp) {
      parts.push(this.timestampFormat === 'time' ? time() : timestamp())
    }

    parts.push(this.formatLevel(name))

    if (this.context) {
      parts.push(`[${this.context}]`)
    }

    parts.push(this.formatMessage(args))

    return parts.join(' ')
  }

  formatLevel (name) {
    const label = name.padEnd(5, ' ')

    if (!this.colorize) {
      return label
    }

    return `${colors[name]}${label}${reset}`
  }

  formatMessage (args) {
    if (args.length === 0) {
      return ''
    }

    if (typeof args[0] === 'string') {
      return util.format(...args)
    }

    return args.map(formatValue).join(' ')
  }
}

module.exports = Logger
module.exports.Logger = Logger
module.exports.LogLevel = LogLevel
