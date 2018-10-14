const express = require('express')
const app = express()
const http = require('http').Server(app)
const io = require('socket.io')(http)
const fs = require('fs')
const path = require('path')
const Canvas = require('canvas')
console.log(Canvas)
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

    fs.readFile('./public/image_stream.jpg', (err, data) => {
      if (err) {
        return console.error(err)
      }

      let img = new Canvas.Image // creating an image object
      img.src = data

      let w = img.width
      let h = img.height

      let canvas = new Canvas(w, h)
      let ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0, w, h, 0, 0, w, h)

      console.log('PID ' + process.pid + ': ditecting cats in the photo...')
      console.log(canvas)
      let cats = kittydar.detectCats(canvas)
      console.log('There are', cats.length, 'cats in this photo')
      console.log(cats)
      let base64Img = ''

      if(cats.length > 0) {
        // Draw a rectangle around the detected cat's face
        ctx.strokeStyle = 'rgba(255, 64, 129, 0.8)'
        ctx.lineWidth = 2

        for (let i = 0; i < cats.length; i++) {
          let cat = cats[i]
          console.log(cat)
          ctx.strokeRect(cat.x, cat.y, cat.width, cat.height)
        }

        base64Img = canvas.toDataURL() // png by default. jpeg is currently not supported by node-canvas
      }
    })

    io.sockets.emit('liveStream', 'image_stream.jpg?_t=' + (Math.random() * 100000))
  })

}
