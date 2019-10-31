const fs = require('fs')
const fetch = require('node-fetch')
const { JSDOM, VirtualConsole }  = require('jsdom')

const projectName = process.env.PROJECT
if (!projectName) {
  console.log('Requires project name. Call: PROJECT=projectName node index.js')
  process.exit(1)
}
console.log('Got projectName', projectName)

const outDir = 'out/'

const convertToAbsolutePath = (href, base) => new URL(href, base).href

const localRelativePath = (href) => {
  return new URL(href).pathname.substring(1)
}

const fetchAndSave = async (resouceUrl) => {
  console.log('fetching...', resouceUrl)
  const res = await fetch(resouceUrl)
  const text = await res.text()
  const filePath = outDir + localRelativePath(resouceUrl)
  const dirPath = filePath.replace(/\/[^/]+$/, '')
  fs.mkdirSync(dirPath, { recursive: true })
  fs.writeFileSync(filePath, text)

  return { text }
}

const fetchHelpData = async () => {
  const url = `https://helpfeel.com/${projectName}/data/helpdata.json`
  await fetchAndSave(url)
}

const main = async () => {
  const url = `http://helpfeel.com/${projectName}/`
  console.log('fetching...', url)
  const res = await fetch(url)
  const html = await res.text()

  const virtualConsole = new VirtualConsole()
  const { document } = new JSDOM(html, { virtualConsole }).window

  // collect resources
  // script tag
  const scripts = Array.from(document.getElementsByTagName('script'))
    .filter(script => !!script.src)
    .map(script => convertToAbsolutePath(script.src, url))
  // link refl=prefetch
  const links = Array.from(document.querySelectorAll('link[rel="prefetch"]'))
    .filter(link => !!link.href)
    .map(link => convertToAbsolutePath(link.href, url))

  const resourceUrls = [...scripts, ...links]

  const svgImages = []
  for (const resouceUrl of resourceUrls) {
    const { text } = await fetchAndSave(resouceUrl)
    // SVG icons in the script
    const svgPaths = text.match(/img\/[^\"\)]*?\.svg/g)
    if (svgPaths) {
      svgImages.push(...svgPaths)
    }
  }

  for (const image of svgImages) {
    const absPath = convertToAbsolutePath(image, url)
    await fetchAndSave(absPath)
  }

  fs.writeFileSync(outDir + `${projectName}/index.html`, html)

  await fetchHelpData()

  console.log('done')
}

main()
