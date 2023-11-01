import express from 'express';
import logger from 'morgan';
import dotenv from 'dotenv';
import { createClient } from '@libsql/client';

import { Server } from 'socket.io';
import { createServer } from 'node:http';
import { log } from 'node:console';

dotenv.config()
const port = process.env.PORT ?? 3000;

const app = express();
const server = createServer( app );
const io = new Server( server, {
    connectionStateRecovery: {}
});

const db = createClient({
    url: "libsql://inviting-nightcrawler-daniel-valente.turso.io",
    authToken: process.env.DB_TOKEN
});

await db.execute(`
    CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        content TEXT,
        username TEXT
    )
`);

io.on('connection', async (socket) => {
    console.log('a user has connected!');

    socket.on('disconnect', () => {
        console.log('an user has disconnected');
    });

    socket.on('chat message', async (msg) => {
        const username = socket.handshake.auth.username ?? 'anonymous';
        let result;
        try {

            result = await db.execute({
                sql: 'INSERT INTO messages (content, username) VALUES (:msg, :username)',
                args: { msg, username }
            });
        } catch (error) {
            console.error(error);
        }
        io.emit('chat message', msg, result.lastInsertRowid.toString(), username);
    });

    if(!socket.recovered) {
        try {
            const results = await db.execute({
                sql: 'SELECT id, content, username FROM messages WHERE id > ?',
                args: [socket.handshake.auth.serverOffset ?? 0]
            });

            results.rows.forEach( row => socket.emit( 'chat message', row.content, row.id.toString(), row.username ));
        } catch (error) {
            console.error(error);
            return;
        }
    }
});

app.use(logger('dev'));

app.get('/', (req, res) => {
    res.sendFile(process.cwd() + '/client/index.html');
});

server.listen(port, () => {
    console.log(`Server running on port ${port}`);
});