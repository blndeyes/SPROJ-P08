const { createClient } = require('redis')

const redis_client = createClient({
  url: process.env.REDIS_URL
})

redis_client.on('error', function (error) {
  console.error('Redis error', error)
})

async function connect_redis() {
  if (redis_client.isOpen === false) {
    await redis_client.connect()
  }
}

module.exports = {
  redis_client,
  connect_redis
}
