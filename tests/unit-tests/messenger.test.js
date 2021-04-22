/**
 * Unit Test for Messenger Module
 * 
 * This module has the following dependencies:
 * 
 * - axios (from axios)
 */

const Messenger = require("../../lib/messenger").Messenger;
const axios = require("axios");

/**
 * Mocking dependencies
 */
jest.mock("axios");
jest.mock("../../lib/kafka/Producer");
jest.mock("../../lib/kafka/Consumer");

jest.mock("../../lib/kafka/TopicManager");

jest.mock("../../lib/auth", () => ({
  getTenants: jest.fn(() => Promise.resolve(['test', 'test', 'test1', 'test2']))
}));

const config = require("../../lib/config");

/* Kafka mock */
const Kafka = {
  producerMock: {
    connect: jest.fn(() => { return Promise.resolve() }),
    disconnect: jest.fn(),
    flush: jest.fn(),
    on: jest.fn(),
    poll: jest.fn(),
    produce: jest.fn(() => Promise.resolve()),
    setPollInterval: jest.fn(),
  },

  consumerMock: {
    commit: jest.fn(),
    connect: jest.fn(() => { return Promise.resolve() }),
    consume: jest.fn(),
    disconnect: jest.fn(),
    on: jest.fn(),
    subscribe: jest.fn((arg0, callback) => { callback('message') }),
    unsubscribe: jest.fn(),
  }
}

describe("Kafka Producer", () => {

  const mockConfig = config;

  beforeAll(() => {
    jest.useFakeTimers()
  })


  beforeEach(() => {
    axios.mockReset();
  })

  afterAll(() => {
    axios.mockRestore();
    jest.useRealTimers();
  })

  describe("Messenger creation", () => {

    it("should create an empty messenger", () => {
      /**
       * This test should create an empty messenger 
       * without initializing and process callbacks
       */

      // >> Tested code
      const messenger = new Messenger("Test-messenger");
      // << Tested code

      // >> Results verification
      expect(messenger.topicManager).toBeDefined();
      expect(messenger.eventCallbacks).toEqual({});
      expect(messenger.subjects).toEqual({});
      expect(messenger.topics).toEqual([]);
      expect(messenger.producerTopics).toEqual({});
      expect(messenger.globalSubjects).toEqual({});
      expect(messenger.queuedMessages).toEqual([]);
      // << Results verification
    })
  })

  describe("Messenger initialization", () => {
    it("should initialize a messenger sucessfully", () => {
      /**
       * This test should initialize a messenger 
       * and it's components (consumer) sucessfully 
       */

      // >> Tested code
      const messenger = new Messenger("Test-messenger", mockConfig);
      messenger.producer = Kafka.producerMock;
      messenger.consumer = Kafka.consumerMock;
      messenger._tenancyConsumer = Kafka.consumerMock;

      messenger._initTenancyConsumer = jest.fn(() => Promise.resolve());

      messenger.init().then(() => {
        // >> Results verification
        expect(messenger.producer.connect).toHaveBeenCalled();
        expect(messenger.consumer.connect).toHaveBeenCalled();
        expect(messenger._tenancyConsumer.connect).toHaveBeenCalled();
        // << Results verification
      });
      // << Tested code
    })


    it("should initialize fail", async () => {
      /**
       * This test should fail on messenger initialization
       */

      // >> Tested code
      Kafka.producerMock.connect = jest.fn(() => { return Promise.reject() });
      Kafka.consumerMock.connect = jest.fn(() => { return Promise.reject() });

      const messenger = new Messenger("Test-messenger", mockConfig);

      messenger._initTenancyConsumer = jest.fn(() => Promise.reject());
      messenger.producer = Kafka.producerMock;
      messenger.consumer = Kafka.consumerMock;
      messenger._tenancyConsumer = Kafka.consumerMock;
      // << Tested code

      // >> Tested code
      messenger.init().catch(() => {
        // << Results verification
        expect(messenger.producer.connect).toHaveBeenCalledTimes(mockConfig.kafka.dojot.connectionRetries);
        // << Results verification
      })
      // << Tested code
    })
  })

  describe("Testing messenger unregister method", () => {

    it("should unregister callback", () => {
      const messenger = new Messenger("Test-Messenger")
      messenger.eventCallbacks['device-data'] = {}
      messenger.eventCallbacks['device-data']['message'] = {}
      messenger.eventCallbacks['device-data']['message']['12345'] = "myCallBack"

      messenger.unregisterCallback("device-data", "message", "12345")
      expect(messenger.eventCallbacks['device-data']['message']['12345']).toBeUndefined();
    })

    it("should fail on unregister method because of subject", () => {
      const messenger = new Messenger("Test-Messenger")
      messenger.eventCallbacks['device-data'] = {}
      messenger.eventCallbacks['device-data']['message'] = {}
      messenger.eventCallbacks['device-data']['message']['12345'] = "my-callback"

      messenger.unregisterCallback("no-device-data", "message", "12345")
      expect(messenger.eventCallbacks['device-data']['message']['12345']).toEqual("my-callback");
    })

    it("should fail on unregister method because of event", () => {
      const messenger = new Messenger("Test-Messenger")
      messenger.eventCallbacks['device-data'] = {}
      messenger.eventCallbacks['device-data']['message'] = {}
      messenger.eventCallbacks['device-data']['message']['12345'] = "my-callback"

      messenger.unregisterCallback("device-data", "no-message", "12345")
      expect(messenger.eventCallbacks['device-data']['message']['12345']).toEqual("my-callback");
    })

    it("should fail on unregister method because of callbackId", () => {
      const messenger = new Messenger("Test-Messenger")
      messenger.eventCallbacks['device-data'] = {}
      messenger.eventCallbacks['device-data']['message'] = {}
      messenger.eventCallbacks['device-data']['message']['12345'] = "my-callback"

      messenger.unregisterCallback("device-data", "message", "no-12345")
      expect(messenger.eventCallbacks['device-data']['message']['12345']).toEqual("my-callback");
    })
  })

  describe("Testing messenger on method", () => {

    it("Should add callback", () => {
      const messenger = new Messenger("Test-Messenger")
      messenger.on("device-data", "message", "myCallBack", "12345")
      messenger.on("device-data", "message", "myCallBack-1", "12345-1")
      expect(messenger.eventCallbacks['device-data']['message']['12345']).toEqual('myCallBack');
      expect(messenger.eventCallbacks['device-data']['message']['12345-1']).toEqual('myCallBack-1');
    })

    it("Should add callback and return callback ID", () => {
      const messenger = new Messenger("Test-Messenger")
      let callbackId = messenger.on("device-data", "message", "myCallBack")
      expect(messenger.eventCallbacks['device-data']['message']).toBeDefined();
      expect(callbackId).toBeDefined();
    })
  })

  describe("Testing emiting message fro all subscribers", () => {

    const emitEventCallbackMock = jest.fn((tenant, data) => { return { tenant, data } })

    it("should emit a message", () => {
      const messenger = new Messenger("Test-Messenger")
      messenger.eventCallbacks['device-data'] = {}
      messenger.eventCallbacks['device-data']['message'] = {}
      messenger.eventCallbacks['device-data']['message']['12345'] = emitEventCallbackMock;
      messenger.emit("device-data", "my-tenant", "message", { "data": "message-data" }, {})
      expect(messenger.eventCallbacks['device-data']['message']['12345']).lastCalledWith("my-tenant", { "data": "message-data" }, {});
    })

    it("should not emit a message", () => {
      const messenger = new Messenger("Test-Messenger")
      messenger.eventCallbacks['device-data'] = {}
      messenger.eventCallbacks['device-data']['no-message'] = {}
      messenger.eventCallbacks['device-data']['no-message']['12345'] = emitEventCallbackMock;
      messenger.emit("device-data", "my-tenant", "message", { "data": "message-data" })
      expect(messenger.eventCallbacks['device-data']['message']).toBeUndefined();
    })
  })

  describe("Testing tenancy consumer init", () => {

    it("should register tenancy sucessfully", async () => {

      // >> Tested code
      const messenger = new Messenger("Test-messenger", config);
      messenger.topicManager.getTopic = jest.fn(() => { return Promise.resolve('test') });

      messenger.producer = Kafka.producerMock
      messenger.consumer = Kafka.consumerMock
      messenger._tenancyConsumer = Kafka.consumerMock
      messenger._processKafkaMessages = jest.fn()

      await messenger._initTenancyConsumer();

      expect(messenger.topics[0]).toEqual('test');

    })

    it("should register tenancy without sucessfully, can't get topic", async (done) => {

      const messenger = new Messenger("Test-messenger", config);
      messenger.topicManager.getTopic = jest.fn(() => { return Promise.reject('error') });

      try {
        await messenger._initTenancyConsumer()
      } catch (error) {
        expect(error).toBeDefined();
        done();
      }

    })
  })

  describe("Testing tenant callback function", () => {

    it("should add a new tenant to cache then remove it", () => {
      const messenger = new Messenger("Test-Mesenger")

      // test create
      const newTenant = { type: "CrEaTe", tenant: "messenger" };
      messenger._processTenantCallback("messenger.tenant", JSON.stringify(newTenant));
      expect(messenger.tenants.length).toEqual(1);
      messenger._processTenantCallback("messenger.tenant", JSON.stringify(newTenant));
      expect(messenger.tenants.length).toEqual(1);

      // test delete
      newTenant.type = "dELETe";
      messenger._processTenantCallback("messenger.tenant", JSON.stringify(newTenant));
      expect(messenger.tenants.length).toEqual(0);
      messenger._processTenantCallback("messenger.tenant", JSON.stringify(newTenant));
      expect(messenger.tenants.length).toEqual(0);

      newTenant.type = "do-nothing";
      messenger._processTenantCallback("messenger.tenant", JSON.stringify(newTenant));
      expect(messenger.tenants.length).toEqual(0);

      // errors
      const badJSONString = "{},"
      messenger._processTenantCallback("messenger.tenant", badJSONString);
      expect(messenger.tenants.length).toEqual(0);

      const emptyJSONString = `{"tenant":"jonas"}`
      messenger._processTenantCallback("messenger.tenant", emptyJSONString);
      expect(messenger.tenants.length).toEqual(0);
    })
  })

  describe("Test Messenger _processKafkaMessages", () => {

    it("should extract extra info from message", () => {

      const messenger = new Messenger("sample-messenger");

      const messageWithExtraInfo = {
        value: { "attr1": "value1", "attr2": 10 },
        extraInfo1: { "extra1": "extra1value" },
        extraInfo2: 100000000,
      }
      const subject = "topic";
      const tenant = "atenant"

      messenger.emit = jest.fn();
      messenger._processKafkaMessages(subject, tenant, messageWithExtraInfo);

      const { value, ...info } = messageWithExtraInfo;

      expect(messenger.emit).toHaveBeenCalledWith(subject, tenant, "message", value.toString("utf-8"), info);

    })

  })

  describe("Test Messenger publish function", () => {

    it("should queued message beacuse producer is not ready", () => {
      const messenger = new Messenger("sample-messenger");
      messenger.producer.isReady = false;

      const object = {
        "key": "key-sample",
        "message": "message-sample",
        "partition": 0,
        "subject": "subject-sample",
        "tenant": "tenant-sample",
      }

      messenger.publish(object.subject, object.tenant, object.message, object.key, object.partition);
      expect(messenger.queuedMessages).toEqual([object]);
    })

    it("should not publish because subject is not in producerTopics", () => {
      const messenger = new Messenger("Test-messenger");
      messenger.producer = Kafka.producerMock;
      messenger.publish("subject-sample", "tenant-sample", "message-sample", "key-sample", 0);
      expect(messenger.producer.produce).not.toHaveBeenCalled()
    })

    it("should not publish message beause tenant is not in producer tocpics", () => {
      const messenger = new Messenger("Test-messenger");
      messenger.producer = Kafka.producerMock;

      const object = {
        "key": "key-sample",
        "message": "message-sample",
        "partition": 0,
        "subject": "subject-sample",
        "tenant": "tenant-sample",
      }
      messenger.producerTopics[object.subject] = {};
      messenger.publish(object.subject, object.tenant, object.message, object.key, object.partition);
      expect(messenger.producer.produce).not.toHaveBeenCalled();
    })

    it("should publish a new message", () => {
      const messenger = new Messenger("Test-messenger");
      messenger.producer = Kafka.producerMock;

      const object = {
        "key": "key-sample",
        "message": "message-sample",
        "partition": 0,
        "subject": "subject-sample",
        "tenant": "tenant-sample",
      }
      messenger.producerTopics[object.subject] = {};
      messenger.producerTopics[object.subject][object.tenant] = object.tenant;
      messenger.publish(object.subject, object.tenant, object.message, object.key, object.partition);
      expect(messenger.producer.produce).toHaveBeenCalled();

    })

    it("should publish a new message because of produce fail", () => {
      const messenger = new Messenger("Test-messenger");
      Kafka.producerMock.produce = jest.fn(() => Promise.reject());
      messenger.producer = Kafka.producerMock;

      const object = {
        "key": "key-sample",
        "message": "message-sample",
        "partition": 0,
        "subject": "subject-sample",
        "tenant": "tenant-sample",
      }
      messenger.producerTopics[object.subject] = {};
      messenger.producerTopics[object.subject][object.tenant] = object.tenant;
      messenger.publish(object.subject, object.tenant, object.message, object.key, object.partition);
      expect(messenger.producer.produce).toHaveBeenCalled();

    })

  })

})
