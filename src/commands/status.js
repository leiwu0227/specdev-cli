import { continueCommand } from './continue.js'

export async function statusCommand(flags = {}) {
  await continueCommand({
    ...flags,
    json: Boolean(flags.json),
    statusPayload: true,
    statusText: !flags.json,
  })
}
