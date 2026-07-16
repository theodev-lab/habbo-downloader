const fetch = require('node-fetch')
const https = require('https')
const path = require('path')
const fs = require('fs')
const { pipeline } = require('stream/promises')
const { XMLParser } = require('fast-xml-parser')

const config = {
  sockets: 100,
  domain: 'com',
  format: 'png',
  revision: false,
  prod: false,
  output: './resource',
}

const opt = {
  agent: new https.Agent({
    keepAlive: true,
    keepAliveMsecs: 24000,
    maxSockets: 100,
    scheduling: 'fifo',
  })
}

const parser = new XMLParser({
  ignoreAttributes: false,
  parseAttributeValue: false,
  parseNodeValue: false,
})

let activeStats = null

function createStats () {
  return {
    total: 0,
    downloaded: 0,
    skipped: 0,
    failed: 0,
    errors: [],
  }
}

function startStats () {
  activeStats = createStats()

  return activeStats
}

function stopStats () {
  const stats = activeStats || createStats()
  activeStats = null

  return stats
}

function recordStat (key) {
  if (activeStats) {
    activeStats[key]++
  }
}

function recordError (src, dst, err) {
  if (!activeStats) {
    return
  }

  activeStats.errors.push({
    src,
    dst,
    status: err.status || null,
    message: err.message,
  })
}

async function fileExists (file) {
  try {
    await fs.promises.access(file, fs.constants.F_OK)
    return true
  } catch (err) {
    return false
  }
}

async function fetchRaw (src) {
  const res = await fetch(src, opt)

  if (res.ok === false) {
    const err = new Error(`${res.status} ${src}`)
    err.status = res.status
    err.src = src

    throw err
  }

  return res
}

async function fetchText (src) {
  const res = await fetchRaw(src)
  const txt = await res.text()

  return txt
}

async function fetchJson (src) {
  const res = await fetchRaw(src)
  const txt = await res.json()

  return txt
}

async function fetchOne (src, dst, replace = false) {
  recordStat('total')

  const file = dst
  dst = path.join(config.output, file)

  if (await fileExists(dst) && replace === false) {
    recordStat('skipped')
    return `skipped: ${src}`
  }

  try {
    const res = await fetchRaw(src)

    await fs.promises.mkdir(path.dirname(dst), { recursive: true })
    await pipeline(res.body, fs.createWriteStream(dst))

    recordStat('downloaded')
    return `${res.status} ${src}`
  } catch (err) {
    recordStat('failed')
    recordError(src, file, err)
    throw err
  }
}

async function fetchMany (all, replace = false) {
  await Promise.allSettled(all.map((v) => fetchOne(v.src, v.dst, replace)))
}

async function fetchUntil (opt, maxRetries = 3, i = 1, failed = 0) {
  try {
    await fetchOne(
      opt.src.replace('%i%', i),
      opt.dst.replace('%i%', i)
    )
    failed = 0
  } catch (err) {
    failed++
  } finally {
    if (failed < maxRetries) {
      return fetchUntil(opt, maxRetries, ++i, failed)
    }
  }
}

async function collectAllTexts () {
  const domain = [
    'com.br', 'com.tr', 'com',
    'de', 'es', 'fi',
    'fr', 'it', 'nl'
  ]

  const all = await Promise.allSettled(
    domain.map((d) => fetchText(`https://www.habbo.${d}/gamedata/external_flash_texts/0`))
  )

  return all.map((txt) => txt.value).join()
}

async function parseXml (txt) {
  return parser.parse(txt)
}

async function initConfig (argv) {
  const c = argv.c || argv.command
  const d = argv.d || argv.domain
  const s = argv.s || argv.sockets
  const f = argv.f || argv.format
  const r = argv.r || argv.revision
  const o = argv.o || argv.output

  if (d) config.domain = d
  if (s) config.sockets = s
  if (r) config.revision = r
  if (o) config.output = o

  const commands = String(c || '')
    .split(',')
    .map((command) => command.trim())

  if ((commands.includes('badges') || commands.includes('all')) && f === 'gif') {
    config.format = 'gif'
  }

  config.prod = (await fetchText(`https://www.habbo.${config.domain}/gamedata/external_variables/0`)).match(/flash\.client\.url=.+(flash-assets-[^/]+)/mi)[1]
}

module.exports = { fetchText, fetchJson, fetchOne, fetchMany, fetchUntil, collectAllTexts, parseXml, initConfig, config, startStats, stopStats, createStats }
