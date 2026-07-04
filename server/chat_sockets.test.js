import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { io as Client } from 'socket.io-client';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe('Chat Socket Server Handlers', () => {
    let serverProcess;
    let client;

    beforeAll(async () => {
        const serverPath = path.resolve(__dirname, 'index.js');
        serverProcess = spawn('node', [serverPath], {
            env: { ...process.env, PORT: '3109' },
            stdio: 'pipe'
        });
        serverProcess.stdout.on('data', () => {});
        serverProcess.stderr.on('data', () => {});

        await new Promise((resolve) => setTimeout(resolve, 200));
        client = Client('http://localhost:3109');
        await new Promise((r) => client.once('connect', r));
    });

    afterAll(async () => {
        client?.disconnect();
        serverProcess?.kill('SIGKILL');
        await new Promise((r) => setTimeout(r, 200));
    });

    it('should sync history and broadcast incoming messages', async () => {
        client.emit('authenticate', 'chat-test-token-1');
        const historyPromise = new Promise((resolve) => {
            client.once('chat:history', resolve);
        });
        const history = await historyPromise;
        expect(Array.isArray(history)).toBe(true);

        const msgPromise = new Promise((resolve) => {
            client.on('chat:newMessage', resolve);
        });
        client.emit('chat:sendMessage', { text: 'Hello socket world!' });

        const received = await msgPromise;
        expect(received.text).toBe('Hello socket world!');
        expect(received.senderId).toBeDefined();
        expect(received.senderName).toBeDefined();
    });
});
