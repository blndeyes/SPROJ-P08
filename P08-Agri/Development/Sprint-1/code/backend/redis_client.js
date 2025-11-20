const { createClient } = require('redis')

// set up a single redis client using env url
const redis_client = createClient({
  url: process.env.REDIS_URL
})

// log redis level errors so we can debug connectivity or auth issues
redis_client.on('error', function (error) {
  console.error('Redis error', error)
})

async function connect_redis() {
  // connect only if not already connected
  if (redis_client.isOpen === false) {
    await redis_client.connect()
  }
}

module.exports = {
  redis_client,
  connect_redis
}
