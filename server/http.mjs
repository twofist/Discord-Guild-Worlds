import express from 'express';
import http from 'http';
import { getDirname } from './getDirname.mjs';

export async function httpApp() {
    const __dirname = await getDirname();
    const app = await express();

    app.use(express.urlencoded({ extended: true }));

    app.set('view engine', 'ejs');
    app.set('views', __dirname + "/views");
    app.use(express.static(__dirname + '/public'));
    app.use('/favicon.ico', express.static(__dirname + '/public/favicon.ico'));

    //gets

    app.get('/', async function (req, res) {
        console.log("redirect home");
        res.redirect('/home');
    });

    app.get('/home', async function (req, res) {
        res.render('pages/index');
    });

    app.use(async function (err, req, res, next) {
        console.error("error 500: ", err.stack);
        res.redirect('/home');
        //res.status(500).send('error 500');
    });

    //The 404 Route (ALWAYS Keep this as the last route)
    app.get('*', async function (req, res) {
        console.log("error 404: ", req.originalUrl);
        res.redirect('/home');
        //res.status(404).send('error 404');
    });

    return { server: http.createServer(), app: app };
}
