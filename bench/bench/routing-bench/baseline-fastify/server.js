const fastify = require('fastify')({ logger: false })
const port = 8092;

fastify.get('/api/data', function (request, reply) {
  reply.send({ status: 'ok', message: 'Hello from Fastify', timestamp: Date.now() })
})

fastify.listen({ port: port, host: '0.0.0.0' }, function (err, address) {
  if (err) {
    console.error(err)
    process.exit(1)
  }
  console.log(`Fastify listening on ${address}`)
})
