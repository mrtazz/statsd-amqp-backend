# StatsD AMQP publisher backend

## Overview
This is a pluggable backend for [StatsD](https://github.com/etsy/statsd), which
publishes stats to an AMQP queue instead of graphite

## Installation

    npm install statsd-amqp-backend

## Configuration
You have to give basic information about your AMQP server to use
```
{ host: 'localhost'
, port: 5672
, login: 'guest'
, password: 'guest'
, vhost: '/'
} }
```

## Dependencies
- [node-amqp](https://github.com/postwait/node-amqp)

## Development
- [Bugs](https://github.com/mrtazz/statsd-amqp-backend/issues)

If you want to contribute:

1. Clone your fork
2. Hack away
3. If you are adding new functionality, document it in the README
4. Add tests so I don't accidentally break functionality
5. Push the branch up to GitHub
6. Send a pull request
