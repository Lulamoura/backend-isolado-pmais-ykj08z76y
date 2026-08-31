const fs = require('node:fs')
const assert = require('node:assert/strict')

const source = fs.readFileSync('pocketbase/hooks/provelo_transport_probe.js', 'utf8')

assert.match(source, /\$apis\.requireAuth\(["']users["']\)/)
assert.match(source, /superadministrador/)
assert.match(source, /PROBE_JA_EXECUTADO/)
assert.match(source, /2026-08-31-transport-probe-r1/)
assert.match(source, /probe_version: PROBE_VERSION/)
assert.match(source, /transport-probe@example\.invalid/)
assert.match(source, /["']Content-Type["']:\s*["']application\/json["']/)
assert.doesNotMatch(source, /hook\.us1\.make\.com/)
assert.doesNotMatch(source, /pmaisservicos\.com\.br/)

console.log('provelo transport probe: 9/9')
