import { test, describe } from 'node:test';
import * as assert from 'node:assert';
import * as path from 'path';
import { PythonBridge } from './pythonBridge';

describe('PythonBridge Integration Tests', () => {
  // Resolve the path to the main.py python script
  const pythonScript = path.resolve(__dirname, '../../src-python/main.py');

  test('should successfully spawn the python process and receive telemetry data', () => {
    return new Promise<void>((resolve, reject) => {
      const bridge = new PythonBridge('python3', pythonScript);
      let telemetryCount = 0;

      bridge.on('message', (payload) => {
        if (payload.type === 'telemetry') {
          telemetryCount++;
          try {
            assert.ok(payload.data);
            assert.strictEqual(typeof payload.data.yaw, 'number');
            assert.strictEqual(typeof payload.data.pitch, 'number');
            assert.strictEqual(typeof payload.data.phone_detected, 'boolean');
          } catch (e) {
            bridge.stop();
            reject(e);
          }

          // Stop after receiving 2 telemetry packets
          if (telemetryCount >= 2) {
            bridge.stop();
          }
        }
      });

      bridge.on('close', (code) => {
        try {
          assert.strictEqual(code, 0);
          assert.ok(telemetryCount >= 2);
          resolve();
        } catch (e) {
          reject(e);
        }
      });

      bridge.on('error', (err) => {
        reject(err);
      });

      bridge.start();
    });
  });

  test('should send ping command and receive pong response', () => {
    return new Promise<void>((resolve, reject) => {
      const bridge = new PythonBridge('python3', pythonScript);
      let pongReceived = false;

      bridge.on('message', (payload) => {
        if (payload.type === 'pong') {
          pongReceived = true;
          bridge.stop();
        }
      });

      bridge.on('close', (code) => {
        try {
          assert.strictEqual(code, 0);
          assert.strictEqual(pongReceived, true);
          resolve();
        } catch (e) {
          reject(e);
        }
      });

      bridge.on('error', (err) => {
        reject(err);
      });

      bridge.start();

      // Give Python process a moment to initialize before sending ping command
      setTimeout(() => {
        bridge.sendCommand('ping');
      }, 300);
    });
  });
});
