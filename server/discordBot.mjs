import Discord from 'discord.js';

export async function discordApp() {
    const client = new Discord.Client();

    client.on('ready', () => {
        console.log(`Logged in as ${client.user.tag}!`);
        client.user.setActivity(":EYE:", { type: "WATCHING" });
    });

    client.on("error", (e) => console.error(e));
    client.on("warn", (e) => console.warn(e));
    client.on("disconnect", (e) => console.log(e));
    //client.on("debug", (e) => console.log(e));
    client.on("reconnecting", (e) => console.log(e));

    await client.login('login token here');

    return client;
}

export function getOnlineUsers(guild) {
    const onlineMembers = guild.members.filter((element) => { return element.presence.status !== "offline" });
    const totalMembers = guild.memberCount;
    return { onlineMembers, totalMembers };
}

export function getGuilds(client) {
    const guilds = client.guilds.map((element) => { return element });
    return guilds;
}

