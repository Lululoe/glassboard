
/**
 * SECURITY WARNING:
 * This file is for LOCAL TESTING AND VERIFICATION ONLY.
 * It contains dummy credentials ('12345') and should NOT be used in production.
 * Ensure this file is not executed in a production environment.
 */

import { loadConfig, getConfig } from './config.js';

// Set generic environment variables
process.env.SERVICES__TESTSERVICE__URL = 'http://test.local';
process.env.SERVICES__TESTSERVICE__APIKEY = '12345';
process.env.SERVICES__NESTED__DEEP__VALUE = 'success';

// Also test overriding an existing service if possible, or just a new one.
// Let's rely on the fact that services.yaml probably doesn't have 'testservice'.

console.log('--- Starting Verification ---');
loadConfig();

const config = getConfig();

console.log('Config loaded.');

const testServiceUrl = config.services?.testservice?.url;
const testServiceKey = config.services?.testservice?.apikey; // Note: logic converts keys to lowercase
const nestedValue = config.services?.nested?.deep?.value;

console.log('SERVICES__TESTSERVICE__URL resolved to:', testServiceUrl);
console.log('SERVICES__TESTSERVICE__APIKEY resolved to:', testServiceKey);
console.log('SERVICES__NESTED__DEEP__VALUE resolved to:', nestedValue);

if (testServiceUrl === 'http://test.local' &&
    testServiceKey === '12345' &&
    nestedValue === 'success') {
    console.log('SUCCESS: Environment variables were correctly mapped to config.');
} else {
    console.error('FAILURE: Environment variables were NOT correctly mapped.');
    console.log('Full Services Config:', JSON.stringify(config.services, null, 2));
    process.exit(1);
}
