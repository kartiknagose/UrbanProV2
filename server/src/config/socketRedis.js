// Redis adapter config for Socket.IO (using ioredis)
const { createAdapter } = require('@socket.io/redis-adapter');
const Redis = require('ioredis');

const redisUrl = process.env.REDIS_URL;
if (!redisUrl) {
	throw new Error('REDIS_URL is not set; skipping Socket.IO Redis adapter');
}

const pubClient = new Redis(redisUrl);
const subClient = pubClient.duplicate();

pubClient.on('error', (err) => {
	console.warn('Socket Redis pub client error:', err.message);
});

subClient.on('error', (err) => {
	console.warn('Socket Redis sub client error:', err.message);
});

module.exports = { createAdapter, pubClient, subClient };
