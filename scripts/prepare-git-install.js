import { createRequire } from 'node:module'

// npm installs dependencies before running `prepare` for Git dependencies.
// Resolving RippleGraph here both triggers that Git packaging path and fails the
// install early if the vendored dependency was not materialized.
createRequire(import.meta.url).resolve('ripplegraph')
