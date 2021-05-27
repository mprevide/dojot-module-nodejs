"use strict";
const logger = require("@dojot/dojot-module-logger").logger;
const Kafka = require('node-rdkafka');
var util = require("util");
const TAG = { filename: "consumer" };

/**
 * @typedef {object} Consumer~Message
 *
 * This description was retrieved from original
 * [node-rdkafka repository](https://github.com/Blizzard/node-rdkafka/blob/master/lib/kafka-consumer.js#L107)
 *
 * @property {buffer} value - the message buffer from Kafka.
 * @property {string} topic - the topic name
 * @property {number} partition - the partition on the topic the
 * message was on
 * @property {number} offset - the offset of the message
 * @property {string} key - the message key
 * @property {number} size - message size, in bytes.
 * @property {number} timestamp - message timestamp
 */

/**
 * Class wrapping a Kafka.KafkaConsumer object.
 */
class Consumer {

  /**
   * Builds a new Consumer.
   *
   * It is important to realize that the `kafka.consumer` and `kafka.producer`
   * configuration are directly passed to node-rdkafka library (which will
   * forward it to librdkafka). You should check [its
   * documentation](https://github.com/edenhill/librdkafka/blob/0.11.1.x/CONFIGURATION.md)
   * to know which are all the possible settings it offers.
   * @param {config} config the configuration to be used by this object
   */
  constructor(config, name) {
    logger.debug('Creating a new Kafka consumer...', TAG);
    logger.debug(`Configuration is: ${util.inspect(config.kafka.consumer)}`, TAG);

    this.config = {};
    this.config['consumer'] = config.kafka.consumer || {};
    this.config['topic'] = config.kafka.topic || {};

    this.consumer = new Kafka.KafkaConsumer(
      this.config['consumer'],
      this.config['topic'],
    );

    this.isReady = false;

    this.messageCallbacks = {};
    this.subscriptions = [];

    this.consumer.on('data', (kafkaMessage) => {
      logger.debug(`Got a message in topic ${kafkaMessage.topic}.`);
      if (kafkaMessage.topic in this.messageCallbacks) {
        logger.debug(`There are ${this.messageCallbacks[kafkaMessage.topic].length} callbacks registered.`);
        for (let callback of this.messageCallbacks[kafkaMessage.topic]) {
          callback(kafkaMessage);
        }
      }
    });

    this.name = name;
    this.isSubscriptionListStable = true;
    this.subscriptionHoldoff = config.kafka.dojot.subscriptionHoldoff;
  }

  /**
   * Connect the consumer to a Kafka cluster
   *
   * This function will wait 2 seconds for the connection to be completed. If
   * this doesn't happen within that time, a timeout will cause the returned
   * promise to be rejected.
   *
   * @returns { Promise } A promise which will be resolved when the connection
   * is completed or rejected if takes too long to complete.
   */
  connect() {
    logger.info("Connecting the consumer...", TAG);
    const readyPromise = new Promise((resolve, reject) => {
      const timeoutTrigger = setTimeout(() => {
        logger.warn("Failed to connect the consumer.", TAG);
        reject("timed out");
      }, 2000);

      this.consumer.on("ready", () => {
        logger.info("Consumer is connected", TAG);
        clearTimeout(timeoutTrigger);
        this.isReady = true;
        if (this.subscriptions.length !== 0) {
          this.consumer.subscribe(this.subscriptions);
        }
        this.consumer.consume();
        resolve();
      });
    });

    logger.info("Requesting consumer connection...", TAG);
    this.consumer.connect();
    logger.info("... consumer connection requested.", TAG);
    return readyPromise;
  }

  /**
   * Subscribe to a particular topic in Kafka
   *
   * The callback function must have one parameter which will contain the
   * received message.
   *
   * If this consumer is not yet connected, it will schedule this subscription,
   * which will be performed only after a successful connection is created.
   *
   * @param {string} topic the topic which this consumer will be subscribed to.
   * @param {*} callback a callback to be invoked whenever a message is received.
   */
  subscribe(topic, callback) {
    if (!(topic in this.messageCallbacks)) {
      this.messageCallbacks[topic] = [];
    }

    this.messageCallbacks[topic].push(callback);

    if (this.subscriptions.indexOf(topic) === -1){
      this.subscriptions.push(topic);
    }
    if (this.isReady === true) {
      logger.debug(`Scheduling a subscription operation...`);
      logger.debug(`Adding new topic ${topic}`);
      this._refreshSubscritptions();
      logger.debug(`Subscribed to topic ${topic}.`);
    }
  }

  /**
   * Unscribsribe to a particular topic in Kafka
   *
   * @param {string} topic  the topic wich this contumer will unsubscribe to
   */
  unsubscribe(topic) {
    if (topic in this.messageCallbacks) {
      delete this.messageCallbacks[topic];
    }

    const topicIndex = this.subscriptions.indexOf(topic);
    if (topicIndex === -1) {
      logger.debug(`The topic: ${topic} doesn't or have been already unsubscribed`, TAG);
      return;
    }

    this.subscriptions.splice(topicIndex, 1);

    if(this.isReady === true) {
      logger.debug(`Scheduling a unsubscription operation...`);
      logger.debug(`Removing topic ${topic}`);
      this._refreshSubscritptions();
      logger.debug(`Unsubscribed on topic ${topic}.`);
    }
  }

  /**
   * Refresh all subscriptions.
   *
   * This method will unsubscribe from all previously subscribed topics and then
   * subscribe to all topics listed in topics attribute. As such, it waits a bit
   * (default is 2.5s) to actually try to subscribe to topics. If the
   * subscription list changed while sleeping, then it will wait until it
   * doesn't change. Also, it won't start any extra timer beside the first one.
   */
  _refreshSubscritptions() {
    if (this.isSubscriptionListStable === true) {
      let currSubscriptions = JSON.parse(JSON.stringify(this.subscriptions));
      this.isSubscriptionListStable = false;
      setTimeout(() => {
        if (currSubscriptions.length === this.subscriptions.length &&
          currSubscriptions.every((item, index) => item === this.subscriptions[index])) {
            logger.debug(`Unsubscribing from topics ${this.subscriptions}`);
            this.consumer.unsubscribe();
            logger.debug(`Subscribing to topics ${this.subscriptions}`);
            this.consumer.subscribe(this.subscriptions);
          } else {
            logger.debug(`List of topics changed in the last few seconds. Delaying again`);
            this.isSubscriptionListStable = true;
            this._refreshSubscritptions();
        }
        this.isSubscriptionListStable = true;
      }, this.subscriptionHoldoff);
    }
  }

  /**
   * Consume a number of messages from a set of topics.
   *
   * If consumer is not yet connected to any Kafka broker, then the
   * returned promise will be already rejected and no message will
   * be consumed.
   *
   * The message format is described in {@link Consumer~Message}.
   * @param {number} maxMessages Number of messages to be consumed.
   * @return {Promise} A promise which will be resolved with the list of
   * received messages.
   */
  consume(maxMessages = 1) {
    if (this.isReady === false) {
      return Promise.reject("consumer not yet ready");
    }
    return new Promise((resolve, reject) => {
      this.consumer.consume(maxMessages, (err, messages) => {
        if (err) {
          reject(err);
        } else {
          console.log("Message consumed!");
          resolve(messages);
        }
      });
    });
  }

  /**
   * Commit the current partition position.
   */
  commit() {
    this.consumer.commit(null);
  }

  /**
   * Disconnect the consumer from a Kafka cluster.
   *
   * If consumer is not yet connected, nothing is executed. The returned
   * promise will be already resolved.
   *
   * @returns {Promise} A promise which will be resolved if consumer was
   * successfully disconnected or rejected otherwise. The rejection will have
   * an attribute containing the error.
   */
  disconnect() {
    if (this.isReady === false) {
      logger.debug("Consumer not connected yet.");
      return Promise.resolve();
    }

    logger.debug("Requesting consumer disconnection...", TAG);
    const disconnectPromise = new Promise((resolve, reject) => {
      const timeoutTrigger = setTimeout(() => {
        console.error("Unnable to disconnect the consumer.");
        reject("timeout");
      }, 100000);

      this.consumer.disconnect((err, info) => {
        if (err) {
          console.error(err);
          reject(err);
        } else {
          logger.debug("... consumer was successfully disconnected.", TAG);
          clearTimeout(timeoutTrigger);
          this.isReady = false;
          resolve(info);
        }
      });
    });
    logger.debug("... consumer disconnection requested.", TAG);
    return disconnectPromise;
  }

}

module.exports = Consumer;


