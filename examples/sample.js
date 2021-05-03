"use strict";
var Messenger = require('../lib/messenger').Messenger;
var config = require('../lib/config')
var logger = require("@dojot/dojot-module-logger").logger;

var messenger = new Messenger("dojot-snoop", config);
messenger.init();

// Create a channel using a default subject "device-data"
messenger.createChannel(config.dojot.subjects.deviceData, "rw");

// Create a channel using a particular subject "service-status"
messenger.createChannel("service-status", "w");

// Register callback to process incoming device data
messenger.on(config.dojot.subjects.deviceData, "message", (tenant, message, extraInfo) => {
  logger.info(`Client: Received message in device data subject.`);
  logger.info(`Client: Tenant is: ${tenant}`);
  logger.info(`Client: Message is: ${message}`);
  logger.info(`Client: ExtraInfo is: ${extraInfo}`);
});

// Publish a message on "service-status" subject using "dojot-management" tenant
messenger.publish("service-status", config.dojot.management.tenant, "service X is up");

// publish a message on "service-status" subject using "dojot-management" tenant
// on partition 1 with "sample" as key
messenger.publish("service-status", config.dojot.management.tenant, "service X is up", "sample", 1);
