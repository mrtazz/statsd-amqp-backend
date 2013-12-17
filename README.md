# StatsD AMQP publisher backend

## Overview

This is a pluggable backend for [StatsD](https://github.com/etsy/statsd), which
publishes stats to an AMQP topic exchange instead of graphite.

## Installation

    npm install statsd-amqp-backend

## Configuration

You have to give basic information about your AMQP server to use:

```
{
  backends: [ "statsd-amqp-backend" ]
, amqp: {
    host: 'localhost'
  , port: 5672
  , login: 'guest'
  , password: 'guest'
  , vhost: '/'
  , defaultExchange: ''
  , messageFormat: 'graphite' // can be 'graphite' or 'json'
  , ssl: {
      enabled : false
    , keyFile : '/path/to/key/file'
    , certFile : '/path/to/cert/file'
    , caFile : '/path/to/cacert/file'
    , rejectUnauthorized : false
    }
  }
}
```

## AMQP

When using `messageFormat: 'json'`, at flush time the entire metrics payload
will be sent to the `defaultExchange` using the routing key `json_payload`,
with contentType `application/json`.
Example:

```
{"counters":{"my-metrics.bad_lines_seen":0,"my-metrics.packets_received":0},"gauges":{},"timers":{},"timer_counters":{},"sets":{},"counter_rates":{"my-metrics.bad_lines_seen":0,"my-metrics.packets_received":0},"timer_data":{},"pctThreshold":[90],"statsd_metrics":{"processing_time":0}}
```

When using `messageFormat: 'graphite'`, at flush time each metric will be sent
individually to the `defaultExchange` using the metric's key name as the routing key,
with contentType `text/graphite`.
Example:

```
stats.counters.my-metrics.bad_lines_seen.rate 0 1387255600
stats.counters.my-metrics.bad_lines_seen.count 0 1387255600
stats.my-metrics.numStats 4 1387255600
stats.my-metrics.processing_time 0 1387255600
```

## Dependencies
- [amqplib](https://github.com/squaremo/amqp.node)

## Development
- [Bugs](https://github.com/mrtazz/statsd-amqp-backend/issues)

If you want to contribute:

1. Clone your fork
2. Hack away
3. If you are adding new functionality, document it in the README
4. Push the branch up to GitHub
5. Send a pull request
