import { httpApp } from './http.mjs';
import { wsApp } from './wsServer.mjs';
import { discordApp } from './discordBot.mjs';

(async function startServers() {
    const port = {
        http: process.env.PORT || 80,
    }

    const http = await httpApp();
    if (http) console.log("http ready")
    const client = await discordApp();
    if (client) console.log("discord ready")
    wsApp(http, port, client);
})();