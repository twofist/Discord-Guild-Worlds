import WebSocket from 'ws';
import { getGuilds, getOnlineUsers } from './discordBot.mjs';

const TYPE = {
    MSG_REC_CONNECTED: 0,
    MSG_REC_DISCONNECTED: 1,
    MSG_REC_GUILD_CHANGE: 2,
    SPLITTER: "-->",
    MSG_SEND_ONLINE_USERS: 4,
    MSG_SEND_TARGET_POSITION: 5,
    MSG_SEND_GRID_SIZE: 6,
    MSG_SEND_USER_CHAT: 8,
    MSG_SEND_CREATE_USERS: 9,
    MSG_SEND_ALL_GUILDS: 10,
};
Object.freeze(TYPE);
const GROUNDTYPE = {
    NOTHING: 0,
    GROUND: 1,
    WATER: 2,
    TREE: 3,
}
Object.freeze(GROUNDTYPE);
let USERS = [];

export function wsApp(http, port, discord) {

    const wss = new WebSocket.Server({
        server: http.server
    });

    http.server.on('request', http.app);

    function noop() { }

    function heartbeat() {
        this.isAlive = true;
    }

    const GUILDS = [];
    testGuild(GUILDS);
    setInterval(() => {
        const newGUILDS = [];
        const discordGuilds = getGuilds(discord);
        discordGuilds.forEach((element) => {
            const discordUsers = getOnlineUsers(element);
            let grid = [];
            let users = [];
            const existingGuild = GUILDS.find((guild) => { return guild.id === element.id });
            if (!existingGuild) {
                grid = createGrid(Math.floor(discordUsers.totalMembers / 2.5));
                users = simplifyUsers(discordUsers.onlineMembers, grid);
            } else {
                grid = existingGuild.grid;
                users = validateUsers(simplifyUsers(discordUsers.onlineMembers, grid), existingGuild);
            }

            newGUILDS.push({
                id: element.id,
                name: element.name,
                userCount: element.memberCount,
                size: element.memberCount,
                onlineUsers: users,
                grid: grid,
            });
        });
        GUILDS.length = 0;
        newGUILDS.forEach((guild) => {
            GUILDS.push(guild);
        });
        GUILDS.forEach((guild) => {
            guild.onlineUsers.forEach((user) => {
                if (!user.interval) {
                    user.interval = true;
                    setInterval(userMove, 2000 + randomNumBetween(0, 2000), user, guild);
                }
            });
        });
        broadCastGuilds(USERS, GUILDS);
    }, 30000);

    wss.on('connection', function connection(ws, req) {
        const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
        console.log(`ip:${ip} connected`, getDateTime());
        const user = { ws: ws, ip: ip, guild: GUILDS[0].id };
        USERS.push(user);
        ws.isAlive = true;
        ws.on('pong', heartbeat);
        ws.on('error', (err) => {
            console.log(err);
        });
        ws.on('close', () => {
            USERS = userDisconnected(USERS, user);
            broadCastOnlineUsers(USERS);
        });
        ws.on('message', (data) => {
            const type = parseInt(extractType(data, TYPE.SPLITTER))
            data = extractValue(data, TYPE.SPLITTER);
            switch (type) {
                case TYPE.MSG_REC_CONNECTED: broadCastOnlineUsers(USERS);
                    sendGuildWorld(user, GUILDS);
                    break;
                case TYPE.MSG_REC_DISCONNECTED: USERS = userDisconnected(USERS, user);
                    break;
                case TYPE.MSG_REC_GUILD_CHANGE: user.guild = data;
                    break;
                default: console.log("type not found", data);
            }
        });
    });

    setInterval(function ping() {
        wss.clients.forEach(function each(ws) {
            if (ws.isAlive === false) return ws.terminate();
            ws.isAlive = false;
            ws.ping(noop);
        });
    }, 30000);

    http.server.listen(port.http, function () {
        console.log(`http/ws server listening on ${port.http}`);
    });
}

function createGrid(size) {
    const resources = [
        { type: GROUNDTYPE.NOTHING, chance: 0 },
        { type: GROUNDTYPE.TREE, chance: 10 },
        { type: GROUNDTYPE.WATER, chance: 10 },
        { type: GROUNDTYPE.GROUND, chance: 80 },
    ]

    if (size < 5) size = 5;
    const grid = []
    for (let col = 0; col < size; col++) {
        grid[col] = [];
        for (let row = 0; row < size; row++) {
            if (col !== 0 && col !== size - 1 && row !== 0 && row !== size - 1) {
                grid[col][row] = getRandomByChance(resources);
            } else {
                grid[col][row] = getRandomByChance([
                    { type: GROUNDTYPE.NOTHING, chance: 30 },
                    { type: GROUNDTYPE.GROUND, chance: 70 }
                ]);
            }
        }
    }

    return grid;
}

function validateUsers(users, guild) {
    const modifiedUsers = [];
    users.forEach((user) => {
        const foundUser = guild.onlineUsers.find((oldUser) => {
            return oldUser.id === user.id;
        });
        if (foundUser) {
            modifiedUsers.push(foundUser);
        } else {
            user.interval = true;
            modifiedUsers.push(user);
            setInterval(userMove, 2000 + randomNumBetween(0, 2000), user, guild);
        }

    });
    return modifiedUsers;
}

function getRandomByChance(resources) {
    const rnd = Math.random();
    let acc = 0;
    for (let ii = 0, r; r = resources[ii]; ii++) {
        acc += r.chance / 100;
        if (rnd < acc) return r.type;
    }
    console.log("empty");
    return 'empty';
}

function simplifyUsers(users, grid) {
    // { name: "twofist", id: 1, position: { x: 1, z: 2 } }

    const newUsers = [];
    users.forEach((user) => {
        let x = randomNumBetween(0, grid.length - 1);
        let z = randomNumBetween(0, grid[x].length - 1);
        while (!checkIfPositionValid({ x, z }, grid)) {
            x = randomNumBetween(0, grid.length - 1);
            z = randomNumBetween(0, grid[x].length - 1);
        }


        newUsers.push({
            name: user.user.username,
            id: user.id,
            avatar: user.user.displayAvatarURL,
            status: user.presence.status,
            clientStatus: user.presence.clientStatus,
            position: {
                x,
                z
            },
            interval: null,
        });
    });

    return newUsers;
}

function sendGuildWorld(user, guilds) {
    const userGuild = guilds.find((guild) => { return guild.id === user.guild });
    sendAllGuilds(user, guilds);
    sendGrid(user, userGuild.grid);
    sendCreateUsers(user, userGuild);
}

function sendToSocket(ws, data) {
    ws.send(data);
}

function sendCreateUsers(user, guild) {
    const data = TYPE.MSG_SEND_CREATE_USERS + TYPE.SPLITTER + JSON.stringify(guild);
    sendToSocket(user.ws, data);
}

function sendAllGuilds(user, guilds) {
    const data = TYPE.MSG_SEND_ALL_GUILDS + TYPE.SPLITTER + JSON.stringify(guilds);
    sendToSocket(user.ws, data);
}

function sendChat(user, sentence) {
    const data = TYPE.MSG_SEND_USER_CHAT + TYPE.SPLITTER + JSON.stringify(sentence);
    sendToSocket(user.ws, data);
}

function sendTargetPosition(guild, position) {
    USERS.forEach((element) => {
        if (element.guild === guild.id) {
            const data = TYPE.MSG_SEND_TARGET_POSITION + TYPE.SPLITTER + JSON.stringify(position);
            sendToSocket(element.ws, data);
        }
    });
}

function sendGrid(user, grid) {
    const data = TYPE.MSG_SEND_GRID_SIZE + TYPE.SPLITTER + JSON.stringify(grid);
    sendToSocket(user.ws, data);
}

function broadCastOnlineUsers(allUsers) {
    const data = TYPE.MSG_SEND_ONLINE_USERS + TYPE.SPLITTER + JSON.stringify(allUsers.length);
    broadcastMessage(allUsers, data)
}

function broadCastGuilds(allUsers, guilds) {
    const data = TYPE.MSG_SEND_ALL_GUILDS + TYPE.SPLITTER + JSON.stringify(guilds);
    broadcastMessage(allUsers, data);
}

function broadcastMessage(users, data) {
    users.forEach((user) => {
        sendToSocket(user.ws, data);
    });
};

function extractType(string, splitter) {
    return string.split(splitter)[0];
}

function extractValue(string, splitter) {
    if (!string.split(splitter)[1]) {
        return undefined;
    }
    return JSON.parse(string.split(splitter)[1]);
}

function getDateTime() {
    const date = new Date();

    let hour = date.getHours();
    hour = (hour < 10 ? "0" : "") + hour;

    let min = date.getMinutes();
    min = (min < 10 ? "0" : "") + min;

    let sec = date.getSeconds();
    sec = (sec < 10 ? "0" : "") + sec;

    let year = date.getFullYear();

    let month = date.getMonth() + 1;
    month = (month < 10 ? "0" : "") + month;

    let day = date.getDate();
    day = (day < 10 ? "0" : "") + day;

    return `DD/MM/YY ${day}/${month}/${year}, H:M:S ${hour}:${min}:${sec}`;
}

function testGuild(guilds) {
    guilds.push({
        name: "PlaceHolder guild 1",
        id: "1",
        size: 5,
        grid: [[0, 1, 1, 3, 1], [1, 3, 1, 1, 1], [1, 1, 1, 1, 1], [0, 1, 1, 1, 1], [1, 2, 1, 1, 1]],
        userCount: 5,
        onlineUsers: [{ name: "twofist", id: "1", position: { x: 1, z: 2 }, interval: null }, { name: "plagueloser", id: "2", position: { x: 2, z: 0 }, interval: null }],
    });

    guilds.push({
        name: "PlaceHolder guild 2",
        id: "2",
        size: 6,
        grid: [[0, 1, 1, 1, 1, 1], [1, 1, 2, 2, 1, 1], [0, 1, 1, 1, 3, 1], [1, 1, 1, 1, 1, 1], [1, 1, 1, 1, 1, 1], [1, 1, 1, 1, 1, 1]],
        userCount: 5,
        onlineUsers: [{ name: "test", id: "7", position: { x: 2, z: 4 }, interval: null }, { name: "connor", id: "3", position: { x: 2, z: 5 }, interval: null }, { name: "john", id: "5", position: { x: 1, z: 4 }, interval: null }],
    });

    guilds.forEach((guild) => {
        guild.onlineUsers.forEach((element, index) => {
            //element.interval = 
            setInterval(userMove, 2000 + randomNumBetween(0, 2000), element, guild);
        });
    });
}

function userMove(user, guild) {
    const targetPosition = getRandomPosition(user, guild.grid);
    if (!checkIfPositionValid(targetPosition, guild.grid)) {
        userMove(user, guild);
        return;
    } else {
        user.position = targetPosition;
        sendTargetPosition(guild, user);
    }
}

function getRandomPosition(user, grid) {
    const decision = randomNumBetween(0, 1);

    if (decision) {
        const moveDecision = randomNumBetween(0, 1);
        if (moveDecision) {
            return { x: user.position.x, z: user.position.z + 1 };
        } else {
            return { x: user.position.x, z: user.position.z - 1 };
        }
    } else {
        const moveDecision = randomNumBetween(0, 1);
        if (moveDecision) {
            return { x: user.position.x + 1, z: user.position.z };
        } else {
            return { x: user.position.x - 1, z: user.position.z };
        }
    }
}

function randomNumBetween(min, max) {
    return Math.floor(Math.random() * (max - min + 1) + min);
}

function checkIfPositionValid(position, grid) {
    if (grid[position.x]) {
        switch (grid[position.x][position.z]) {
            case GROUNDTYPE.NOTHING: return false
            case GROUNDTYPE.WATER: return false;
            case GROUNDTYPE.TREE: return false;
            default: return grid[position.x][position.z];
        }
    }
    return grid[position.x];
}

function userDisconnected(array, user) {
    console.log(`ip:${user.ip} disconnected`, getDateTime());
    return removeElementsFromArray(array, [user]);
}

function removeElementsFromArray(fromArray, toRemove) {
    const removed = fromArray.filter(element => !toRemove.includes(element));
    return removed;
}