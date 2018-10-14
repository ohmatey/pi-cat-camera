const express = require('express')
const app = express()
const http = require('http').Server(app)
const io = require('socket.io')(http)
const fs = require('fs')
const path = require('path')
const { loadImage } = require('canvas')
console.log(loadImage)

const kittydar = require('./kittydar/kittydar')

const spawn = require('child_process').spawn
var proc

app.use('/', express.static(path.join(__dirname, 'stream')))

app.use(express.static('public'))

app.get('/', function(req, res) {
  res.sendFile(__dirname + '/index.html')
})

const sockets = {}

io.on('connection', socket => {

  sockets[socket.id] = socket
  console.log("Total clients connected : ", Object.keys(sockets).length)

  socket.on('disconnect', () => {
    delete sockets[socket.id]

    // no more sockets, kill the stream
    if (Object.keys(sockets).length == 0) {
      app.set('watchingFile', false)
      if (proc) proc.kill()
      fs.unwatchFile('./public/image_stream.jpg')
    }
  })

  socket.on('start-stream', () => {
    startStreaming(io)
  })
})

http.listen(3000, () => {
  console.log('listening on *:3000')
})

const stopStreaming = () => {
  if (Object.keys(sockets).length == 0) {
    app.set('watchingFile', false)
    if (proc) proc.kill()
    fs.unwatchFile('./public/image_stream.jpg')
  }
}

const startStreaming = io => {
  if (app.get('watchingFile')) {
    io.sockets.emit('liveStream', 'image_stream.jpg?_t=' + (Math.random() * 100000))
    return
  }

  const args = ["-w", "640", "-h", "480", "-o", "./public/image_stream.jpg", "-t", "999999999", "-tl", "10"]
  proc = spawn('raspistill', args)

  console.log('Watching for changes...')

  app.set('watchingFile', true)

  fs.watchFile('./public/image_stream.jpg', (current, previous) => {

    loadImage('./public/image_stream.jpg')
      .then(img => {
        console.log(img)
        const cats = kittydar.detectCats(img);

        console.log("there are", cats.length, "cats in this photo");

        console.log(cats[0]);
      })

    io.sockets.emit('liveStream', 'image_stream.jpg?_t=' + (Math.random() * 100000))
  })

}
