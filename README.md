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
, backends: [ "statsd-amqp-backend" ]
, amqpHost: 'localhost'
, amqpPort: 5672
, amqpLogin: 'guest'
, amqpPassword: 'guest'
, amqpVhost: '/'
, amqpDefaultExchange: ''
, amqpMessageFormat: 'graphite' // can be 'graphite' or 'json'
, amqpSsl: {
      enabled : false
    , keyFile : '/path/to/key/file'
    , certFile : '/path/to/cert/file'
    , caFile : '/path/to/cacert/file'
    , rejectUnauthorized : false
  }
}
```

## AMQP

When using `amqpMessageFormat: 'json'`, at flush time the entire metrics payload 
will be sent to the `amqpDefaultExchange` using the routing key `json_payload`, 
with contentType `application/json`.
Example:

```
{"counters":{"my-metrics.bad_lines_seen":0,"my-metrics.packets_received":0},"gauges":{},"timers":{},"timer_counters":{},"sets":{},"counter_rates":{"my-metrics.bad_lines_seen":0,"my-metrics.packets_received":0},"timer_data":{},"pctThreshold":[90],"statsd_metrics":{"processing_time":0}}
```

When using `amqpMessageFormat: 'graphite'`, at flush time each metric will be sent
individually to the `amqpDefaultExchange` using the metric's key name as the routing key, 
with contentType `text/graphite`.
Example:

```
my-metrics.bad_lines_seen 0 1387057730
my-metrics.macbook-aw.bad_lines_seen 0 1387057730
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
