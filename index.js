const express = require('express');
var session = require('express-session');
const merchantRoutes = require('./routes/merchant');
const { sendResponse } = require("./helpers/helper");
const element = require("./helpers/index");
const { PORT } = require("./config/custom.config");

const app = express();

// const PORT = 7000;

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use(session({ 
    cookie: { maxAge: 60000 },
    store: new session.MemoryStore,
    saveUninitialized: true,
    resave: 'true',
    secret: 'secret'
}));

app.post("/api/merchant-services/parameterEncryptionTemp", async (req, res) => {
    if (req.method == 'POST' && (!req.headers['key'] || !req.headers['iv'])) {
        return res.send(await sendResponse(1));
    }else{
        let encParameters = await element.parameterEncryption(JSON.stringify(req.body), req.headers['key'], req.headers['iv']);
        return res.send({
            data: encParameters
        });
    }
});

app.post("/api/merchant-services/parameterDecryptionTemp", async (req, res) => {
    if (req.method == 'POST' && (!req.headers['key'] || !req.headers['iv'])) {
        return res.send(await sendResponse(1));
    }else{
        let orignalParameters = await element.parameterDecryption(req.body.data, req.headers['key'], req.headers['iv']);
        return res.send(orignalParameters);
    }
});

app.use("/api/merchant-services", async (req, res, next) => {
    if (req.method == 'POST' && (!req.headers['userid'] || !req.headers['password'])) {
        return res.send(await sendResponse(1));
    }
    next();
}, merchantRoutes);

// catch 404 and forward to error handler
app.all('*', async (req, res) => {
    res.send(await sendResponse(15));
});

const start = async () => {
    try {
        app.listen(PORT, () => {
            console.log(`${PORT} port connected`);
        });
    } catch (error) {
        console.log(error);
    }
}

start();