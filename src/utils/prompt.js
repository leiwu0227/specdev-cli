import { createInterface } from 'readline'

function createRl() {
  return createInterface({
    input: process.stdin,
    output: process.stdout,
  })
}

export function ask(question) {
  const rl = createRl()
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close()
      resolve(answer.trim())
    })
  })
}

export async function askChoice(prompt, options) {
  console.log('')
  console.log(prompt)
  options.forEach((opt, i) => {
    console.log(`  ${i + 1}) ${opt}`)
  })

  while (true) {
    const answer = await ask(`Choice (1-${options.length}): `)
    const num = Number.parseInt(answer, 10)
    if (num >= 1 && num <= options.length) {
      return num - 1
    }
    console.log(`  Please enter a number between 1 and ${options.length}`)
  }
}
