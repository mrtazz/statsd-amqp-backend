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
 *   amqpQueue: queue for the AMQP server.
 *   amqpDefaultExchange: default exchange to use.
 */
var util = require('util');

var amqp;
var conn;

var debug;
var flushInterval;

var amqpQueue;

var amqpStats = {};

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

  if (debug) {
    util.log("Publishing metrics: "+JSON.stringify(data));
  }
  conn.publish(amqpQueue, JSON.stringify(data));


};


var backend_status = function(writeCb)
{
  for (stat in amqpStats) {
    writeCb(null, 'amqp', stat, amqpStats[stat]);
  }
};

exports.init = function(startup_time, config, events, amq)
{
  // take the amqp module as a param for testing
  amqp = typeof amq !== 'undefined' ? amq : require('amqp');
  debug = config.debug;
  // amqp settings
  amqpQueue = config.amqpQueue || 'statsd';
  var options = {};

  options.host = config.amqpHost;
  options.port = config.amqpPort || 5672;
  if (typeof config.amqpLogin !== 'undefined')
  {
    options.login = config.amqpLogin;
  }
  if (typeof config.amqpPassword !== 'undefined')
  {
    options.password = config.amqpPassword;
  }
  options.vhost = config.amqpVhost || '/';
  options.defaultExchange = config.amqpDefaultExchange || '';

  conn = amqp.createConnection(options);

  amqpStats.last_flush = startup_time;
  amqpStats.last_exception = startup_time;

  flushInterval = config.flushInterval;

  events.on('flush', flush_stats);
  events.on('status', backend_status);

  return true;
};
