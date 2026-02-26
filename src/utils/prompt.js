import { createInterface } from 'readline'

/**
 * Creates a readline interface for interactive prompts
 */
function createRl() {
  return createInterface({
    input: process.stdin,
    output: process.stdout,
  })
}

/**
 * Ask a question and return the answer
 *
 * @param {string} question - The prompt text
 * @returns {Promise<string>}
 */
export function ask(question) {
  const rl = createRl()
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close()
      resolve(answer.trim())
    })
  })
}

/**
 * Ask user to choose from numbered options
 *
 * @param {string} prompt - The question text
 * @param {Array<string>} options - List of option labels
 * @returns {Promise<number>} Selected index (0-based)
 */
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

/**
 * Ask yes/no question
 *
 * @param {string} question - The prompt (y/n will be appended)
 * @returns {Promise<boolean>}
 */
export async function askYesNo(question) {
  while (true) {
    const answer = await ask(`${question} (y/n): `)
    if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes') {
      return true
    }
    if (answer.toLowerCase() === 'n' || answer.toLowerCase() === 'no') {
      return false
    }
    console.log('  Please enter y or n')
  }
}

/**
 * Ask user for multi-line text input (ends with empty line)
 *
 * @param {string} prompt - The prompt text
 * @returns {Promise<string>}
 */
export async function askMultiLine(prompt) {
  console.log(prompt)
  console.log('  (Enter an empty line to finish)')

  const rl = createRl()
  const lines = []

  return new Promise((resolve) => {
    rl.on('line', (line) => {
      if (line.trim() === '') {
        rl.close()
        resolve(lines.join('\n'))
      } else {
        lines.push(line)
      }
    })
  })
}

/**
 * Present a suggestion and let user accept, edit, reject, or add custom
 *
 * @param {object} suggestion - { title: string, body: string }
 * @returns {Promise<{ action: 'accept'|'edit'|'reject'|'custom', title: string, body: string }|null>}
 */
export async function presentSuggestion(suggestion) {
  console.log('')
  console.log('─'.repeat(60))
  console.log(`📝 ${suggestion.title}`)
  console.log('')
  console.log(suggestion.body)
  console.log('')

  const choice = await askChoice('What would you like to do?', [
    'Accept as-is',
    'Edit before saving',
    'Reject / Skip',
  ])

  if (choice === 0) {
    return { action: 'accept', title: suggestion.title, body: suggestion.body }
  }

  if (choice === 1) {
    const newTitle = await ask(
      `Title [${suggestion.title}]: `
    )
    const editedTitle = newTitle || suggestion.title

    console.log('Enter the updated observation:')
    const newBody = await askMultiLine('')
    const editedBody = newBody || suggestion.body

    return { action: 'edit', title: editedTitle, body: editedBody }
  }

  // choice === 2 -> reject
  return null
}

/**
 * Ask user if they want to add a custom observation
 *
 * @returns {Promise<{ title: string, body: string }|null>}
 */
export async function askCustomObservation() {
  const wantsCustom = await askYesNo(
    'Would you like to add a custom observation?'
  )
  if (!wantsCustom) {
    return null
  }

  const title = await ask('Title: ')
  if (!title) return null

  const body = await askMultiLine('Observation:')
  if (!body) return null

  return { title, body }
}
