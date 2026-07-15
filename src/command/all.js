const commands = [
  'articles',
  'badgeparts',
  'badges',
  'clothes',
  'effects',
  'ficons',
  'furnitures',
  'gamedata',
  'gordon',
  'habboswf',
  'hotelview',
  'icons',
  'mp3',
  'pets',
  'promo',
]

async function handle () {
  for (const command of commands) {
    console.log(`\n[all] starting ${command}...`)

    try {
      await require(`./${command}`)()
      console.log(`[all] finished ${command}`)
    } catch (err) {
      console.log(`[all] failed ${command}: ${err.message}`)
    }
  }
}

module.exports = handle
