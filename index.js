const express = require('express')
const app = express()
const http = require('http').Server(app)
const io = require('socket.io')(http)
const fs = require('fs')
const path = require('path')

const Canvas = require('./kittydar/node_modules/canvas')
const kittydar = require('./kittydar/kittydar')

const spawn = require('child_process').spawn
var proc

app.use('/', express.static(path.join(__dirname, 'stream')))

app.use(express.static('public'))

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html')
})

const sockets = {}

io.on('connection', socket => {
  io.sockets.emit('liveStreamMessage', 'find a 😺')
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

  io.sockets.emit('liveStreamMessage', 'Streaming')

  const args = ["-w", "640", "-h", "480", "-o", "./public/image_stream.jpg", "-t", "999999999", "-tl", "10"]
  proc = spawn('raspistill', args)

  proc.on('exit', code => {
    fs.readFile('./public/image_stream.jpg', (err, data) => {
      if (err) {
        return console.error(err)
      }

      io.sockets.emit('liveStreamMessage', 'found image')

      const img = new Canvas.Image
      img.src = data

      const w = img.width
      const h = img.height

      const canvas = new Canvas(w, h)
      const ctx = canvas.getContext('2d')
      
      ctx.drawImage(img, 0, 0, w, h, 0, 0, w, h)

      const cats = kittydar.detectCats(canvas)

      const base64Img = ''

      if (cats.length > 0) {
        io.sockets.emit('liveStreamMessage', 'found a 😺 in the image!')
        // Draw a rectangle around the detected cat's face
        ctx.strokeStyle = 'rgba(255, 64, 129, 0.8)'
        ctx.lineWidth = 2

        for (let i = 0; i < cats.length; i++) {
          const cat = cats[i]
          console.log(cat)
          ctx.strokeRect(cat.x, cat.y, cat.width, cat.height)
        }

        base64Img = canvas.toDataURL()
      } else {
        io.sockets.emit('liveStreamMessage', 'No cats found 😢')
      }
    })
  })

  console.log('Watching for changes...')

  app.set('watchingFile', true)

  fs.watchFile('./public/image_stream.jpg', (current, previous) => {
    io.sockets.emit('liveStream', 'image_stream.jpg?_t=' + (Math.random() * 100000))
  })

}
