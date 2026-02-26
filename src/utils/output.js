export function blankLine() {
  console.log('')
}

export function printSection(title) {
  console.log(title)
}

export function printLines(lines = []) {
  for (const line of lines) {
    console.log(line)
  }
}

export function printBullets(items = [], prefix = '  - ') {
  for (const item of items) {
    console.log(`${prefix}${item}`)
  }
}

export function printKeyValue(key, value) {
  console.log(`${key}: ${value}`)
}

export function printListSection(title, items = []) {
  if (!items.length) return
  console.log(title)
  for (const item of items) {
    console.log(`  - ${item}`)
  }
}
