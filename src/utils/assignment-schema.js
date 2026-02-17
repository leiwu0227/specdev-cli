import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const schemaPath = join(__dirname, '../../specdev.assignment-schema.json')

export const ASSIGNMENT_SCHEMA = JSON.parse(readFileSync(schemaPath, 'utf-8'))
export const ASSIGNMENT_PHASES = ASSIGNMENT_SCHEMA.phases

