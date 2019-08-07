#!/usr/bin/env node

const download = require('./')

if (process.argv.length < 4) {
  console.error('Usage: hls-dl <url> <dest>')
  process.exit(1)
}

download(process.argv[2], process.argv[3], { log: true }, function (err) {
  if (err) throw err
})
