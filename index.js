
const request = require('request')
const fs = require('fs')
const path = require('path')
const mkdirp = require('mkdirp')
const crypto = require('crypto')
const { resolve } = require('url')

module.exports = download

function download (url, dest, opts, cb) {
  if (typeof opts === 'function') return download(url, dest, null, opts)
  if (!opts) opts = {}

  const max = 10
  const visited = new Set()

  let running = 0
  let error = null

  const req = request.defaults({
    jar: request.jar()
  })

  const queue = [{ url, path: path.join(dest, 'index.m3u8') }]

  kick(null)

  function kick (err) {
    if (err) error = err
    if (!running && (!queue.length || error)) return cb(error)

    while (!error && queue.length && running < max) {
      const next = queue.pop()

      running++

      if (/\.m3u8$/.test(next.path)) {
        playlist(next.url, next.path, done)
      } else if (/\.ts$/.test(next.path)) {
        data(next.url, next.path, done)
      } else {
        maybePlaylist(next.url, next.path, done)
      }
    }
  }

  function done (err) {
    running--
    kick(err)
  }

  function maybePlaylist (url, dest, cb) {
    if (visited.has(url)) return process.nextTick(cb, null)
    visited.add(url)

    if (opts.log) console.log('Unsure about the type of ' + url)
    get(url, function (err, res) {
      if (err) return cb(err)

      visited.delete(url)
      if (res.body.slice(0, 7).toString() === '#EXTM3U') playlist(url, dest, cb)
      else data(url, dest, cb)
    })
  }

  function playlist (url, dest, cb) {
    if (visited.has(url)) return process.nextTick(cb, null)
    visited.add(url)

    if (opts.log) console.log('Downloading playlist ' + url)
    get(url, function (err, res) {
      if (err) return cb(err)

      const lines = res.body.toString().split('\n').map(map).join('\n')

      writeFile(dest, lines, cb)
    })
  }

  function writeFile (dest, buf, cb) {
    mkdirp(path.dirname(dest), function () {
      fs.writeFile(dest + '.tmp', buf, function (err) {
        if (err) return cb(err)
        fs.rename(dest + '.tmp', dest, cb)
      })
    })
  }

  function data (url, dest, cb) {
    if (visited.has(url)) return process.nextTick(cb, null)
    visited.add(url)

    fs.stat(dest, function (_, st) {
      if (st) return cb(null)

      if (opts.log) console.log('Downloading segment ' + url)
      get(url, function (err, res) {
        if (err) return cb(err)
        writeFile(dest, res.body, cb)
      })
    })
  }

  function map (s) {
    return s.replace(/(((https?:\/\/)|(^\/))[^"]+)/g, function (n) {
      const u = resolve(url, n)
      let name = u.replace(/^https?:\/\//, '').split('?')[0].replace(/:/g, '-')
      name = path.join('/', path.normalize(name))
      const q = u.split('?')
      if (q.length > 1) name += '.' + hash(q[1]) + path.extname(name)

      const p = path.join(dest, name)

      queue.push({
        url: u,
        path: p
      })

      return name
    })
  }

  function get (url, cb) {
    req.get(url, { encoding: null }, function (err, res) {
      if (err) return cb(err)
      if (res.statusCode !== 200) return cb(new Error('Bad status: ' + res.statusCode))
      cb(null, res)
    })
  }
}

function hash (s) {
  return crypto.createHash('sha256').update(s).digest('hex')
}
