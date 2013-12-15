/*
 * Flush stats to AMQP
 *
 * To enable this backend, include 'statsd-amqp-backend' in the backends
 * configuration array:
 *
 *   backends: ['statsd-amqp-backend']
 *
 * This backend supports the following config options:
 *
 *   amqpHost: Hostname of AMQP server.
 *   amqpPort: Port to contact AMQP server at.
 *   amqpLogin: Login for the AMQP server.
 *   amqpPassword: Password for the AMQP server.
 *   amqpVhost: vhost for the AMQP server.
 *   amqpDefaultExchange: default AMQP topic exchange to use.
 *   amqpMessageFormat: AMQP message format: graphite or json
 *   amqpSsl: SSL options for AMQP.
 */
var util  = require('util');
var fs    = require('fs');

var amqp;
var open;
var channel;

var debug;
var prefixStats;
var flushInterval;
var flush_counts;

var amqpStats = {};
var options = {};
var exchangeOptions = {};

// prefix configuration
var globalPrefix;
var prefixCounter;
var prefixGauge;
var prefixTimer;
var globalSuffix;

var deepCopy = function(obj) {
  if (Object.prototype.toString.call(obj) === '[object Array]') {
    var out = [], i = 0, len = obj.length;
    for ( ; i < len; i++ ) {
      out[i] = arguments.callee(obj[i]);
    }
    return out;
  }
  if (typeof obj === 'object') {
    var out = {}, i;
    for ( i in obj ) {
      out[i] = arguments.callee(obj[i]);
    }
    return out;
  }
  return obj;
};

var flush_stats = function(ts, metrics)
{
  var data = deepCopy(metrics);
  var payload = [];
  var key;
  var value;
  var result;
  var ts_suffix = ' ' + ts + "\n";

  return open.createChannel().then(function(ch) {
    channel = ch;
    var ok = ch.assertExchange(options.exchange, 'topic', {durable: true});
    return ok.then(function() {

      switch(options.format)
      {
      case 'graphite':
        exchangeOptions = {
          'contentType': 'text/graphite',
          'appId': 'statsdAMQP',
          'deliveryMode': 2
        }

        // Send counters
        for (key in metrics.counters) {
          value = metrics.counters[key];
          var valuePerSecond = metrics.counter_rates[key];

          result = globalPrefix + prefixCounter + key + '.rate' + globalSuffix + valuePerSecond + ts_suffix;
          payload.push({
            metric: globalPrefix + prefixCounter + key + '.rate',
            result: result
          });

          if (flush_counts) {
            result = globalPrefix + prefixCounter + key + '.count' + globalSuffix + value + ts_suffix;
            payload.push({
              metric: globalPrefix + prefixCounter + key + '.count',
              result: result
            });
          }
        }

        // Send gauges
        for (key in metrics.gauges) {
          value = metrics.gauges[key];

          result = globalPrefix + prefixGauge + key + globalSuffix + value + ts_suffix;
          payload.push({
            metric: globalPrefix + prefixGauge + key,
            result: result
          });
        }

        // Send timers
        for (key in metrics.timer_data) {
          for (timer_data_key in metrics.timer_data[key]) {
            if (typeof(metrics.timer_data[key][timer_data_key]) === 'number') {
              result = globalPrefix + prefixTimer + key + timer_data_key + globalSuffix + metrics.timer_data[key][timer_data_key] + ts_suffix;
              payload.push({
                metric: globalPrefix + prefixTimer + key + timer_data_key,
                result: result
               });
            } else {
              for (var timer_data_sub_key in metrics.timer_data[key][timer_data_key]) {
                if (debug) {
                  util.log(metrics.timer_data[key][timer_data_key][timer_data_sub_key].toString());
                }
                result = globalPrefix + prefixTimer + key + timer_data_key + '.' + timer_data_sub_key + globalSuffix + metrics.timer_data[key][timer_data_key][timer_data_sub_key] + ts_suffix;
                payload.push({
                  metric: globalPrefix + prefixTimer + key + timer_data_key + '.' + timer_data_sub_key,
                  result: result
                 });
              }
            }
          }
        }

        // Send other stats
        result = globalPrefix + prefixStats + '.numStats' + globalSuffix + payload.length + ts_suffix;
        payload.push({
          metric: globalPrefix + prefixStats + '.numStats',
          result: result
        });

        // Send statsd metrics
        for (key in metrics.statsd_metrics) {
          result = globalPrefix + prefixStats + '.' + key + globalSuffix + metrics.statsd_metrics[key] + ts_suffix;
          payload.push({
            metric: globalPrefix + prefixStats + '.' + key,
            result: result
          });
        }

        post_stats(payload, function() {
          if (debug) {
            util.log("numStats: " + payload.length);
          }
          return ch.close();
        });
        break;
      case 'json':
        exchangeOptions = {
          'contentType': 'application/json',
          'appId': 'statsdAMQP',
          'deliveryMode': 2
        }

        payload.push({
          metric: 'json_payload',
          result: JSON.stringify(data)
        });
        post_stats(payload, function() {
          return ch.close();
        });
        break;
      }
    });
  });
}

var post_stats = function(payload, callback)
{
  try {
    for (key in payload) {
      data = payload[key];
      channel.publish(options.exchange, data.metric, new Buffer(String(data.result)), exchangeOptions);
      if (debug) {
        util.log("Published: " + data.result);
      }
    }
    amqpStats.last_flush = Math.round(new Date().getTime() / 1000);
    callback();
  } catch(e) {
      if (debug) {
        util.log(e);
      }
    amqpStats.last_exception = Math.round(new Date().getTime() / 1000);
  }
}

var backend_status = function(writeCb)
{
  for (stat in amqpStats) {
    writeCb(null, 'amqp', stat, amqpStats[stat]);
  }
};

var connect = function(connectUri, sslOptions, cb)
{
  amqp.connect(connectUri, sslOptions).then(function(connection) {
    connection.on('error', function(err) {
      if (debug) {
        util.log("Disconnected from AMQP server, retrying..");
      }
      connect(connectUri, sslOptions, function(cb) {
        open = cb;
      });
    });
    cb(connection);
  }).then(null, console.warn);
}

exports.init = function(startup_time, config, events)
{
  // set defaults for prefixes & suffix
  globalPrefix  = "stats.";
  prefixCounter = "counters.";
  prefixGauge   = "gauges.";
  prefixTimer   = "timers.";
  globalSuffix  = ' ';

  amqp = require('amqplib');
  debug = config.debug;
  prefixStats = config.prefixStats || 'statsd';

  // amqp settings
  var sslOptions    = {};
  var connectPrefix = 'amqp://';

  options.host      = config.amqpHost || 'localhost';
  options.port      = config.amqpPort || 5672;
  options.login     = config.amqpLogin || 'guest';
  options.password  = config.amqpPassword || 'guest';
  options.vhost     = config.amqpVhost || '/';
  options.exchange  = config.amqpDefaultExchange || '';
  options.format    = config.amqpMessageFormat || 'json';

  // ssl settings
  if (typeof config.amqpSsl !== 'undefined' && config.amqpSsl.enabled == true) {
    connectPrefix   = 'amqps://';
    options.port    = config.amqpPort || 5671;
    var passphrase  = config.amqpSsl.passphrase || '';
    var reject      = config.amqpSsl.rejectUnauthorized || false;

    sslOptions = {
      passphrase: passphrase,
      cert: fs.readFileSync(config.amqpSsl.certFile),
      key: fs.readFileSync(config.amqpSsl.keyFile),
      ca: [fs.readFileSync(config.amqpSsl.caFile)],
      rejectUnauthorized: reject
    }
  }

  connectUri = connectPrefix + options.login + ':' + options.password + '@' + options.host + ':' + options.port + '/' + options.vhost;
  connect(connectUri, sslOptions, function(cb) {
    open = cb;
  });

  amqpStats.last_flush = startup_time;
  amqpStats.last_exception = startup_time;

  flushInterval = config.flushInterval;

  flush_counts = typeof(config.flush_counts) === "undefined" ? true : config.flush_counts;

  events.on('flush', flush_stats);
  events.on('status', backend_status);

  return true;
};
