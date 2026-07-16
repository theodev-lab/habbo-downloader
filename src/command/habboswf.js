const { fetchOne, config } = require('../functions')

async function handle () {
  await fetchOne(`https://images.habbo.com/gordon/${config.prod}/Habbo.swf`, `gordon/${config.prod}/Habbo.swf`)
}

module.exports = handle
