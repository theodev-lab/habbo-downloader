const { fetchMany, fetchText } = require('../functions')

const regex = /src=".*habbo-web-articles\/([^"]+\.png)".+(?=class="news-header__image news-header__image--thumbnail">)/gim

async function parse(txt) {
	const all = []
	const match = [...txt.matchAll(regex)]

	match.forEach((match) => {
		all.push(match[1])
		all.push(match[1].replace('_thumb.png', '.png'))
	})

	return all
}

async function handle() {
	let failed = 0
	let i = 1
	let pages = 0

	while (failed < 3) {
		try {
			const txt = await fetchText(`https://images.habbo.com/habbo-web-news/en/production/all_${i++}.html`)
			const all = await parse(txt)
			pages++

			await fetchMany(
				[...all].map((item) => {
					return {
						src: `https://images.habbo.com/web_images/habbo-web-articles/${item}`,
						dst: `habbo-web-articles/${item}`
					}
				})
			)

			failed = 0
		} catch (err) {
			if (err.status !== 404) {
				throw err
			}

			failed++
		}
	}

	if (pages === 0) {
		throw new Error('No article index pages found')
	}
}

module.exports = handle
