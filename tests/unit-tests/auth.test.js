"use strict";

const KcAdminClient = require("keycloak-admin").default;
const auth = require("../../lib/auth");
const defaultConfig = require("../../lib/config");

jest.mock('keycloak-admin');
jest.setTimeout(30000);

describe('When keycloak respond successfully', () => {


    let tenants = [
    {
        someField: 'some field',
        id: 'my_realm'
    }]

    KcAdminClient.mockImplementation(() => {
        return {
            auth: () => {
                return null
            },
            realms: {
                find: () => {
                    return tenants
                }
            }
        };
    });

    afterEach(() => {
        KcAdminClient.mockReset();
    });

    afterAll(() => {
        KcAdminClient.mockRestore();
    });

    it('should format tenants array correctly', async () => {
        let data = await auth.getTenants()
        return expect(data).toEqual(tenants.map(t => t.id));
    });
});

describe('When keycloak respond with error', () => {
    beforeAll(() => {

        KcAdminClient.mockImplementation(() => {
            return {
                auth: () => {
                    throw new Error('some error')
                }
            };
        });
    });

    afterAll(() => {
        KcAdminClient.mockRestore();
    });

    it('should try again n times', async () => {

        try {
            await auth.getTenants();
        } catch (error) {
            expect(KcAdminClient.mock.calls.length - 1).toBe(defaultConfig.keycloak.connectionRetries)
        }

    });

    it('should throw an exception', async () => {

        try {
            await auth.getTenants()
        } catch (error) {
            expect(error).toBe('keycloak admin: some error')
        }

    });


});


describe('When it uses a configuration file', () => {
    beforeAll(() => {
        jest.mock('./keycloak-admin'.default, () => {
            return jest.fn().mockImplementation(() => {
                return {
                    auth: () => { }
                };
            });
        });
    });

    afterEach(() => {
        KcAdminClient.mockReset();
    });

    afterAll(() => {
        KcAdminClient.mockRestore();
    });

    it('should get parameters from a configuration file', async () => {

        expect.assertions(2);

        try {
            await auth.getTenants()
        } catch (error) {
            expect(KcAdminClient.mock.instances[0].auth.mock.calls[0][0]).
                toEqual(defaultConfig.keycloak.credentials),

                expect(KcAdminClient.mock.calls[0][0].baseUrl).
                    toBe(defaultConfig.keycloak.basePath)
        }
    });
});

describe('When a dummy token is requested', () => {

    it('should generate a dummy token', () => {

        let dummyToken = auth.getManagementToken("sample-tenant")
        expect(dummyToken).not.toBeNull();
    });
});

