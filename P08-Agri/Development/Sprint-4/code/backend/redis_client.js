const { createClient } = require('redis')

const redis_client = createClient({
  url: process.env.REDIS_URL
})

redis_client.on('error', function (error) {
  console.error('Redis error', error)
})

async function connect_redis() {
  if (!process.env.REDIS_URL || process.env.SKIP_REDIS === 'true') {
    console.warn('Redis disabled (REDIS_URL missing or SKIP_REDIS=true).')
    return false
  }

  if (redis_client.isOpen === false) {
    await redis_client.connect()
  }

  return true
}

module.exports = {
  redis_client,
  connect_redis
}
