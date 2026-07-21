#!/usr/bin/env node

import { parseArgv } from '../src/utils/cli.js'
import { dispatchCommand } from '../src/commands/dispatch.js'

const { command, flags, positionalArgs } = parseArgv(process.argv)
await dispatchCommand(command, positionalArgs, flags)
