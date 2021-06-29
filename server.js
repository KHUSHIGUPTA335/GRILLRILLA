require('dotenv').config()
const express = require('express')
const app = express()
const ejs = require('ejs') //Engine
const path = require('path')
const expressLayout = require('express-ejs-layouts')
const PORT = process.env.PORT || 3000
const session = require('express-session')
const flash = require('express-flash')
const MongoDbStore = require('connect-mongo')
    // Database
const mongoose = require('mongoose')
    // Passport
const passport = require('passport')
const Emitter = require('events')

// Database Connection
const url = process.env.MONGO_CONNECTION_URL
mongoose.connect(url, { useNewUrlParser: true, useCreateIndex: true, useUnifiedTopology: true, useFindAndModify: true });
const connection = mongoose.connection;
connection.once('open', () => {
    console.log('Database connected...')
}).catch((err) => {
    console.log('Connection failed...')
});


// Event emitter
const eventEmitter = new Emitter()
app.set('eventEmitter', eventEmitter)


// Session Config
app.use(session({
    secret: process.env.COOKIES_SECRET,
    resave: false,
    store: MongoDbStore.create({
        client: connection.getClient()
    }),
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 * 24 } // 24 hours
}))


// Passport config
const passportInit = require('./app/config/passport')
passportInit(passport)
app.use(passport.initialize())
app.use(passport.session())

// Flash
app.use(flash())

// Assets
app.use(express.static(__dirname))
app.use(express.urlencoded({ extend: false }))
app.use(express.json())

// Global MiddleWare
app.use((req, res, next) => {
    res.locals.session = req.session
    res.locals.user = req.user
    next()
})

// Set template engine
app.use(expressLayout)
app.set('views', path.join(__dirname, '/resources/views'))
app.set('view engine', 'ejs')

// Routes
require('./routes/web')(app)
app.use((req, res) => {
    res.render('errors/404')
})

const server = app.listen(PORT, () => {
    console.log(`Listening on port ${PORT}`)
})

// Socket

const io = require('socket.io')(server)
io.on('connection', (socket) => {
    // Join
    socket.on('join', (orderId) => {
        socket.join(orderId)
    })
})

eventEmitter.on('orderUpdated', (data) => {
    io.to(`order_${data.id}`).emit('orderUpdated', data)
})

eventEmitter.on('orderPlaced', (data) => {
    io.to('adminRoom').emit('orderPlaced', data)
})