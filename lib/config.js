"use strict";
/**

   *
   * The configuration object should have the follwing attributes:
   * ```json
   * kafka: {
   *   producer: {
   *
   *   },
   *   consumer: {
   *
   *   }
   * }
   * ```
   * For instance, an example of such object would be:
   *
   * ```json
   * kafka: {
   *   producer: {
   *       "metadata.broker.list": "kafka:9092",
   *       "compression.codec": "gzip",
   *       "retry.backoff.ms": 200,
   *       "message.send.max.retries": 10,
   *       "socket.keepalive.enable": true,
   *       "queue.buffering.max.messages": 100000,
   *       "queue.buffering.max.ms": 1000,
   *       "batch.num.messages": 1000000,
   *       "dr_cb": true
   *   },
   *   consumer: {
   *     "group.id": "data-broker",
   *     "metadata.broker.list": "kafka:9092",
   *   },
   *   dojot: {
   *       "subscription_holdoff": Number(process.env.DOJOT_SUBSCRIPTION_HOLDOFF) || 2500
   *   }
   * }
   * ```
 *
 */


module.exports={
    kafka: {
      producer: {
          "metadata.broker.list": process.env.KAFKA_HOSTS || "kafka:9092",
          "compression.codec": "gzip",
          "retry.backoff.ms": 200,
          "message.send.max.retries": 10,
          "socket.keepalive.enable": true,
          "queue.buffering.max.messages": 100000,
          "queue.buffering.max.ms": 1000,
          "batch.num.messages": 1000000,
          "dr_cb": true
      },

      consumer: {
          "group.id": process.env.KAFKA_GROUP_ID || "dojot-module",
          "metadata.broker.list": process.env.KAFKA_HOSTS || "kafka:9092",
      },
      dojot: {
          subscriptionHoldoff: Number(process.env.DOJOT_SUBSCRIPTION_HOLDOFF) || 2500,
          timeoutSleep: 5,
          connectionRetries: 5
      }
    },
    databroker: {
      url: process.env.DATA_BROKER_URL || "http://data-broker",
      timeoutSleep: 2,
      connectionRetries: 5,
    },
    auth: {
      url: process.env.AUTH_URL || "http://auth:5000",
      timeoutSleep: 5,
      connectionRetries: 5,
    },
    keycloak: {
      basePath: process.env.KEYCLOAK_URL || "http://keycloak:8080/auth",
      timeoutSleep: 5,
      connectionRetries: 5,
      credentials: {
        username: process.env.KEYCLOAK_USER || "admin",
        password: process.env.KEYCLOAK_PASSWORD || "admin",
        grantType: "password",
        clientId: process.env.KEYCLOAK_CLIENT_ID || "cli",
      }
    },
    deviceManager: {
      url: process.env.DEVICE_MANAGER_URL || "http://device-manager:5000",
      timeoutSleep: 5,
      connectionRetries: 3,
    },
    dojot: {
      management: {
        user: process.env.DOJOT_MANAGEMENT_USER || "dojot-management",
        tenant: process.env.DOJOT_MANAGEMENT_TENANT || "dojot-management"
      },
      subjects: {
        tenancy: process.env.DOJOT_SUBJECT_TENANCY || "dojot.tenancy",
        devices: process.env.DOJOT_SUBJECT_DEVICES || "dojot.device-manager.device",
        deviceData: process.env.DOJOT_SUBJECT_DEVICE_DATA || "device-data",
      },
      events:{
        tenantEvent: {
          NEW_TENANT: "new-tenant",
          DELETE_TENANT: "delete-tenant"
        },
        tenantActionType: {
          CREATE: "create",
          DELETE: "delete"
        }
      }
    }
};
