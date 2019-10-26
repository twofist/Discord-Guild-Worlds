import path from 'path';

export async function getDirname() {
    if (process.platform === "win32") {
        return path.join(path.dirname(decodeURI(new URL(import.meta.url).pathname))).substring(1);
    } else {
        return path.join(path.dirname(decodeURI(new URL(import.meta.url).pathname)));
    }
}