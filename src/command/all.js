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
    await require(`./${command}`)()
  }
}

module.exports = handle
module.exports.commands = commands
