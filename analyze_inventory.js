const sharp = require("sharp")
const fs = require("fs")

async function analyzeInventory() {
  try {
    const imagePath =
      "e:\\2.project\\game\\zombie\\public\\assets\\chapter-1\\player\\inventory-debug.png"
    const image = sharp(imagePath)
    const metadata = await image.metadata()

    console.log(`Image Size: ${metadata.width} x ${metadata.height}`)

    const { data, info } = await image
      .raw()
      .toBuffer({ resolveWithObject: true })

    let minRedX = info.width,
      maxRedX = 0,
      minRedY = info.height,
      maxRedY = 0
    let minYellowX = info.width,
      maxYellowX = 0,
      minYellowY = info.height,
      maxYellowY = 0

    for (let y = 0; y < info.height; y++) {
      for (let x = 0; x < info.width; x++) {
        const idx = (y * info.width + x) * info.channels
        const r = data[idx]
        const g = data[idx + 1]
        const b = data[idx + 2]

        // Red Detection (R high, G/B low)
        if (r > 200 && g < 100 && b < 100) {
          if (x < minRedX) minRedX = x
          if (x > maxRedX) maxRedX = x
          if (y < minRedY) minRedY = y
          if (y > maxRedY) maxRedY = y
        }

        // Yellow Detection (R high, G high, B low)
        if (r > 200 && g > 200 && b < 100) {
          if (x < minYellowX) minYellowX = x
          if (x > maxYellowX) maxYellowX = x
          if (y < minYellowY) minYellowY = y
          if (y > maxYellowY) maxYellowY = y
        }
      }
    }

    console.log("--- Red Area (Items) ---")
    console.log(`X: ${minRedX}, Y: ${minRedY}`)
    console.log(`Width: ${maxRedX - minRedX}, Height: ${maxRedY - minRedY}`)

    console.log("--- Yellow Area (Stats) ---")
    console.log(`X: ${minYellowX}, Y: ${minYellowY}`)
    console.log(
      `Width: ${maxYellowX - minYellowX}, Height: ${maxYellowY - minYellowY}`,
    )
  } catch (error) {
    console.error("Error analyzing image:", error)
  }
}

analyzeInventory()
