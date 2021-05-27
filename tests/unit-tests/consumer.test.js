"use strict";

/**
 * Unit tests for Consumer module
 *
 * This module has the following dependencies:
 *
 * - kafka (from node-rdkafka)
 */


const Consumer = require("../../lib/kafka/Consumer");
const Kafka = require('node-rdkafka');

//
// Mocking dependencies
//
jest.mock("node-rdkafka");
jest.useFakeTimers();


describe("Kafka consumer", () => {
    var mockConfig = {
        kafka: {
            consumer: "consumer-config",
            dojot: {
                subscriptionHoldoff: 10,
            },
        },
    };
    var mockKafka = {
        consumer: {
            commit: jest.fn(),
            connect: jest.fn(),
            consume: jest.fn(),
            disconnect: jest.fn(),
            on: jest.fn(),
            subscribe: jest.fn(),
            unsubscribe: jest.fn(),
        }
    };

    beforeAll(() => {
        Kafka.KafkaConsumer.mockImplementation(() => {
            return mockKafka.consumer;
        });
    });

    afterEach(() => {
        mockKafka.consumer.commit.mockReset();
        mockKafka.consumer.connect.mockReset();
        mockKafka.consumer.consume.mockReset();
        mockKafka.consumer.disconnect.mockReset();
        mockKafka.consumer.on.mockReset();
        mockKafka.consumer.on.mockReset();
        mockKafka.consumer.subscribe.mockReset();
        mockKafka.consumer.unsubscribe.mockReset();
    });

    afterAll(() => {
        mockKafka.consumer.commit.mockRestore();
        mockKafka.consumer.connect.mockRestore();
        mockKafka.consumer.consume.mockRestore();
        mockKafka.consumer.disconnect.mockRestore();
        mockKafka.consumer.on.mockRestore();
        mockKafka.consumer.subscribe.mockRestore();
        mockKafka.consumer.unsubscribe.mockRestore();
    });
    describe("Consumer creation", () => {
    it("should create a consumer successfully", () => {
        /**
         * The constructor calls the following dependencies functions:
         * - KafkaConsumer constructor
         * - KafkaConsumer.on
         */

        // >> Tested code
        const consumer = new Consumer(mockConfig, "sample-consumer");
        // << Tested code

        // >> Results verification
        expect(Kafka.KafkaConsumer).toHaveBeenCalledWith(mockConfig.kafka.consumer,{});
        expect(consumer.consumer).toBeDefined();
        expect(consumer.isReady).toBeFalsy();
        expect(consumer.messageCallbacks).toEqual({});
        expect(consumer.subscriptions).toEqual([]);
        expect(consumer.name).toEqual("sample-consumer");
        expect(consumer.isSubscriptionListStable).toBeTruthy();
        expect(consumer.subscriptionHoldoff).toEqual(10);
        // << Results verification
    });

    it("should register a valid callback for data processing", () => {
        /**
         * This test will test the callback passed to consumer.on() call.
         * It will then invoke a callback registered in messageCallbacks
         * dictionary (key is the Kafka subject)
         */
        const messageCallback = jest.fn();
        const kafkaMessage = { topic: "sample-topic" };

        // >> Tested code
        const consumer = new Consumer(mockConfig, "sample-consumer");
        consumer.messageCallbacks["sample-topic"] = [messageCallback];
        const callback = mockKafka.consumer.on.mock.calls[0][1];
        callback(kafkaMessage);
        // << Tested code

        // >> Results verification
        expect(messageCallback).toHaveBeenCalledWith(kafkaMessage);
        // << Results verification
    });

    it("should register a valid callback for data processing (and do nothing)", () => {
        /**
         * This test will check if the registered callback does anything if
         * there is no callback associated to any topic.
         */
        const kafkaMessage = { topic: "sample-topic" };

        // >> Tested code
        new Consumer(mockConfig, "sample-consumer-no-topic");
        const callback = mockKafka.consumer.on.mock.calls[0][1];
        callback(kafkaMessage);
        // << Tested code

        // It should only print messages in log.
    });
    });
    describe("Kafka connection handling", () => {
    it("should connect to Kafka successfully", (done) => {
        /**
         * This test case will execute the connect function. As it returns a
         * promise that will wait for Kafka library to emit a 'ready' event to
         * be resolved, then we'll have to append two more promises: one for
         * retrieve the registered callback and execute it and another one to
         * check whether executing that callback leads to a proper state of
         * consumer object (i.e., checks whether it calls the correct functions.
         */
        // >> Tested code
        const consumer = new Consumer(mockConfig, "test-connect");
        const connectPromise = consumer.connect();
        // << Tested code

        // This promise will get the callback registered in the 'consumer.on'
        // call
        const callbackPromise = new Promise((resolve) => {
            expect(mockKafka.consumer.on).toHaveBeenCalled();
            // Generate a 'ready' event so that it won't trigger a rejection
            // First call is performed at Consumer consructor
            const mockReadyCallback = mockKafka.consumer.on.mock.calls[1][1]
            consumer.subscriptions.push("test-connect-subscription");
            mockReadyCallback();
            resolve();
        });

        // This will check whether all expected functions were called and
        // states are correct.
        const postCallbackAnalysis = new Promise((resolve) => {
            expect(consumer.isReady).toBeTruthy();
            expect(mockKafka.consumer.subscribe).toHaveBeenCalledWith(["test-connect-subscription"]);
            expect(mockKafka.consumer.consume).toHaveBeenCalled();
            resolve();
        });
        expect(mockKafka.consumer.connect).toHaveBeenCalled();
        Promise.all([connectPromise, callbackPromise, postCallbackAnalysis]).then(() => {
            done();
        }).catch((error) => {
            done(error);
        });
    });

    it("should connect to Kafka successfully even if it has no subscriptions", (done) => {
        /**
         * This test checks the same things as the previous one. The difference
         * is that there is no subscription..
         */
        // >> Tested code
        const consumer = new Consumer(mockConfig, "test-connect-empty");
        const connectPromise = consumer.connect();
        // << Tested code

        // This promise will get the callback registered in the 'consumer.on'
        // call
        const callbackPromise = new Promise((resolve) => {
            expect(mockKafka.consumer.on).toHaveBeenCalled();
            const mockReadyCallback = mockKafka.consumer.on.mock.calls[1][1]
            mockReadyCallback();
            resolve();
        });

        const postCallbackAnalysis = new Promise((resolve) => {
            expect(consumer.isReady).toBeTruthy();
            expect(mockKafka.consumer.consume).toHaveBeenCalled();
            resolve();
        });
        expect(mockKafka.consumer.connect).toHaveBeenCalled();
        Promise.all([connectPromise, callbackPromise, postCallbackAnalysis]).then(() => {
            done();
        }).catch((error) => {
            done(error);
        });
    });

    it("should reject connection call if Kafka is not reachable", (done) => {
        /**
         * This is basically the same test as the previous one. The difference is
         * that this time we will not call the registered callback simulating a
         * problem in which Kafka can't be reached (and then the 'ready' event
         * never happens).
         */
        // >> Tested code
        const consumer = new Consumer(mockConfig, "test-connect-timeout");
        const connectPromise = consumer.connect();
        // << Tested code

        const callbackPromise = new Promise((resolve) => {
            expect(mockKafka.consumer.on).toHaveBeenCalled();
            // This time, the callback won't be called - we want to test its
            // timeout procedure
            jest.runAllTimers();
            resolve();
        });
        expect(mockKafka.consumer.connect).toHaveBeenCalled();
        Promise.all([connectPromise, callbackPromise]).then(() => {
            done("error - timeout was expected");
        }).catch((error) => {
            expect(error).toEqual("timed out");
            done();
        });
    });

    it("should disconnect from Kafka successfully", (done) => {
        /**
         * This test will check whether the Consumer can successfully disconnect
         * from Kafka, in the same way it connects to it
         */
        // >> Tested code
        const consumer = new Consumer(mockConfig, "test-disconnect");
        consumer.isReady = true;
        const disconnectPromise = consumer.disconnect();
        // << Tested code

        // This promise will get the callback registered in the 'consumer.disconnect'
        // call
        const callbackPromise = new Promise((resolve) => {
            expect(mockKafka.consumer.disconnect).toHaveBeenCalled();
            const mockReadyCallback = mockKafka.consumer.disconnect.mock.calls[0][0];
            mockReadyCallback(undefined, "sample-disconnect-info");
            resolve();
        });

        const postCallbackAnalysis = new Promise((resolve) => {
            expect(consumer.isReady).toBeFalsy();
            resolve();
        });

        Promise.all([disconnectPromise, callbackPromise, postCallbackAnalysis]).then(() => {
            done();
        }).catch(() => {
            done("should not generate errors");
        });
    });

    it("should reject promise when problems occurs during Kafka disconnection", (done) => {
        /**
         * This test will check whether the Consumer can successfully deal with
         * problems while disconnecting from Kafka
         */
        // >> Tested code
        const consumer = new Consumer(mockConfig, "test-disconnect-error");
        consumer.isReady = true;
        const disconnectPromise = consumer.disconnect();
        // << Tested code

        const callbackPromise = new Promise((resolve) => {
            expect(mockKafka.consumer.disconnect).toHaveBeenCalled();
            const mockReadyCallback = mockKafka.consumer.disconnect.mock.calls[0][0];
            mockReadyCallback("disconnection-error");
            resolve();
        });

        const postCallbackAnalysis = new Promise((resolve) => {
            expect(consumer.isReady).toBeFalsy();
            resolve();
        });

        Promise.all([disconnectPromise, callbackPromise, postCallbackAnalysis]).then(() => {
            done("should give an error");
        }).catch((error) => {
            expect(error).toEqual("disconnection-error");
            done();
        });
    });

    it("should reject promise when a timeout occurs during Kafka disconnection", (done) => {
        /**
         * This test will check whether the Consumer can successfully deal with
         * timeouts while disconnecting from Kafka
         */
        // >> Tested code
        const consumer = new Consumer(mockConfig, "test-disconnect-timeout");
        consumer.isReady = true;
        const disconnectPromise = consumer.disconnect();
        // << Tested code

        const callbackPromise = new Promise((resolve) => {
            expect(mockKafka.consumer.disconnect).toHaveBeenCalled();
            jest.runAllTimers();
            resolve();
        });

        const postCallbackAnalysis = new Promise((resolve) => {
            expect(consumer.isReady).toBeFalsy();
            resolve();
        });

        Promise.all([disconnectPromise, callbackPromise, postCallbackAnalysis]).then(() => {
            done("should give an error");
        }).catch((error) => {
            expect(error).toEqual("timeout");
            done();
        });
    });
    it("should do nothing while disconnecting if consumer is not connected", (done) => {
        /**
         * This test will check whether the Consumer can successfully deal with
         * timeouts while disconnecting from Kafka
         */
        // >> Tested code
        const consumer = new Consumer(mockConfig, "test-disconnect-dummy");
        consumer.isReady = false;
        const disconnectPromise = consumer.disconnect();
        // << Tested code

        Promise.all([disconnectPromise]).then(() => {
            done();
        }).catch((error) => {
            done(`should not generate any error: ${error}`);
        });
    });
    });
    describe("Subscription handling", () => {
    it("should subscribe successfully to a single topic", () => {
        /**
         * This test case will execute the subscribe function with an empty
         * state (no callbacks previously registered to the same topic). It will
         * consider that the consumer is connected (isReady is true)
         */

        let mockCallback = "sample-mock-callback";
        let mockCallback2 = "sample-mock-callback2";
        // >> Tested code
        const consumer = new Consumer(mockConfig, "test-susbcribe-single");
        consumer.isReady = true;
        consumer.subscribe("sample-topic", mockCallback);
        // << Tested code

        // >> Results verification
        expect(consumer.subscriptions).toEqual(["sample-topic"]);
        expect(consumer.messageCallbacks).toEqual({ "sample-topic": [mockCallback] });
        jest.runAllTimers();
        expect(mockKafka.consumer.unsubscribe).toBeCalled();
        expect(mockKafka.consumer.subscribe).toBeCalledWith(["sample-topic"]);
        // << Results verification

        // >> Tested code
        // Adding an extra callback
        consumer.subscribe("sample-topic", mockCallback2);
        // << Tested code

        // >> Results verification
        expect(consumer.subscriptions).toEqual(["sample-topic"]);
        expect(consumer.messageCallbacks).toEqual({
            "sample-topic": [mockCallback, mockCallback2]
        });
        jest.runAllTimers();
        expect(mockKafka.consumer.unsubscribe).toBeCalledTimes(2);
        expect(mockKafka.consumer.subscribe).toBeCalledWith(["sample-topic"]);
        // << Results verification
    });

    it("should not subscribe to anything if consumer is not yet ready", () => {
        /**
         * This test case will execute the subscribe function with the consumer
         * not yet ready.
         */

        let mockCallback = "sample-mock-callback";
        // >> Tested code
        const consumer = new Consumer(mockConfig, "test-susbcribe-not-ready");
        consumer.isReady = false;
        consumer.subscribe("sample-topic-not-ready", mockCallback);
        // << Tested code

        // >> Results verification
        expect(consumer.subscriptions).toEqual(["sample-topic-not-ready"]);
        expect(consumer.messageCallbacks).toEqual({ "sample-topic-not-ready": [mockCallback] });
        expect(mockKafka.consumer.unsubscribe).not.toBeCalled();
        // << Results verification
    });

    it("should subscribe successfully to a multiple topics", () => {
        /**
         * This test case will execute the subscribe function with an empty
         * state (no callbacks previously registered to the same topic). It will
         * consider that the consumer is connected (isReady is true)
         */

        let mockCallback = "sample-mock-callback";
        // >> Tested code
        const consumer = new Consumer(mockConfig, "test-susbcribe-multiple");
        consumer.isReady = true;
        consumer.subscribe("sample-topic-1", mockCallback);
        // << Tested code

        // >> Results verification
        expect(consumer.subscriptions).toEqual(["sample-topic-1"]);
        expect(consumer.messageCallbacks).toEqual({ "sample-topic-1": [mockCallback] });
        expect(consumer.isSubscriptionListStable).toBeFalsy();
        // << Results verification

        // >> Tested code
        consumer.subscribe("sample-topic-2", mockCallback);
        // << Tested code

        // >> Results verification
        expect(consumer.subscriptions).toEqual(["sample-topic-1", "sample-topic-2"]);
        expect(consumer.messageCallbacks).toEqual({
            "sample-topic-1": [mockCallback],
            "sample-topic-2": [mockCallback]
        });
        jest.runAllTimers();
        jest.runAllTimers();
        expect(mockKafka.consumer.unsubscribe).toBeCalledTimes(1);
        expect(mockKafka.consumer.subscribe).toBeCalledTimes(1);
        expect(mockKafka.consumer.subscribe).toBeCalledWith(["sample-topic-1", "sample-topic-2"]);
        // << Results verification
    });

    it("should unsubscribe sucessfully from a topic", () => {
        
        /**
         * This test subscribe and unsubscribe to a topic then check if topic
         * where deleted after unsubscribe
         */

        // >> Tested code
        let mockCallback = "sample-mock-callback";
        const consumer = new Consumer(mockConfig, "test-unsubscribe");
        consumer.isReady = true;
        consumer.subscribe("sample-subscribe", mockCallback);
        consumer.unsubscribe("sample-subscribe");
        // >> unsubcribe

        // >> Test unsubsribe for a tenant that doenst exist
        consumer.unsubscribe("sample-subscribe");
        // >> end test

        expect(consumer.subscriptions).toEqual([]);
        // >> result verification
    });

    it("should remove from subcription list even consumer state", () => {
        /**
         * This test try to subscribe then unsubscribe 
         * to a topic then check if topic where deleted 
         * after unsubscribe, topic should be on subsciption list
         * deleted even of consumer state change
         */

        // >> Tested code
        let mockCallback = "sample-mock-callback";
        const consumer = new Consumer(mockConfig, "test-should-remove-from-list");
        consumer.isReady = true;
        consumer.subscribe("sample-subscribe", mockCallback);
        // >> end Test

        expect(consumer.subscriptions).toEqual(["sample-subscribe"]);
        // >> result verification

        // >> Test code
        consumer.isReady = false;
        consumer.unsubscribe("sample-subscribe");
        // >> end Test

        expect(consumer.subscriptions).toEqual([]);
        // >> result verification
    });
    });

    describe("Message consumption", () => {

    it ("should consume exactly one message from Kafka", (done) => {
        /**
         * This test will try to consume only one message from Kafka, supposing
         * it has successfully connected the consumer.
         */
        // >> Tested code
        const consumer = new Consumer(mockConfig, "test-consume-single");
        consumer.isReady = true;
        consumer.consume().then((message) => {
            expect(message).toEqual("sample-unique-message");
            done();
        });
        // << Tested code

        // >> Results verification
        // Ok, part of it is already coded.
        expect(mockKafka.consumer.consume).toBeCalled();
        let consumeCallback = mockKafka.consumer.consume.mock.calls[0][1]
        consumeCallback(undefined, "sample-unique-message");
        // << Results verification
    });

    it("should indicate any errors while consuming messages", (done) => {
        /**
         * This test will check what happens when the Kafka consume message
         * fails.
         */
        const consumer = new Consumer(mockConfig, "test-consume-single-fail");
        consumer.isReady = true;
        consumer.consume().then(() => {
            done("should not receive messages");
        }).catch((error) => {
            expect(error).toEqual("test-consume-error");
            done();
        });
        // << Tested code

        // >> Results verification
        // Ok, part of it is already coded.
        expect(mockKafka.consumer.consume).toBeCalled();
        let consumeCallback = mockKafka.consumer.consume.mock.calls[0][1]
        consumeCallback("test-consume-error", "sample-unique-message");
        // << Results verification
    });

    it("should block any message consumption if consumer is not yet ready", (done) => {
        /**
         * This test will check what happens when the Kafka consume message
         * fails.
         */

        // >> Tested code
        const consumer = new Consumer(mockConfig, "test-consume-single-fail");
        consumer.isReady = false;
        consumer.consume().then(() => {
            done("should not receive messages");
        }).catch((error) => {
            expect(error).toEqual("consumer not yet ready");
            done();
        });
        // << Tested code

        // >> Results verification
        // Ok, part of it is already coded.
        expect(mockKafka.consumer.consume).not.toBeCalled();
        // << Results verification
    });

    it("should send a commit request to Kafka", () => {
        /**
         * This test will check whether the commit function is actually called
         * with `null` parameter, supposing it has successfully connected to
         * Kafka
         */
        // >> Tested code
        const consumer = new Consumer(mockConfig, "test-commit");
        consumer.isReady = true;
        consumer.commit();
        // << Tested code

        // >> Results verification
        expect(mockKafka.consumer.commit).toBeCalledWith(null);
        // << Results verification
    });
    });
});
