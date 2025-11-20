const { createClient } = require('redis')

// shared redis client using env url
const redis_client = createClient({
  url: process.env.REDIS_URL
})

// basic error logging
redis_client.on('error', function (error) {
  console.error('Redis error', error)
})

async function connect_redis() {
  // open connection only if not already open
  if (redis_client.isOpen === false) {
    await redis_client.connect()
  }
}

module.exports = {
  redis_client,
  connect_redis
}
