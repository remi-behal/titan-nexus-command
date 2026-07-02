import net from 'net';

/**
 * Finds a free TCP port by binding temporarily to port 0.
 * @returns {Promise<number>} An unused port number.
 */
export function getFreePort() {
    return new Promise((resolve, reject) => {
        const server = net.createServer();
        server.unref();
        server.on('error', reject);
        server.listen(0, () => {
            const { port } = server.address();
            server.close(() => {
                resolve(port);
            });
        });
    });
}
