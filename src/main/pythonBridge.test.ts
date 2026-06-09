import { test, describe } from 'node:test';
import * as assert from 'node:assert';
import * as path from 'path';
import { PythonBridge } from './pythonBridge';

describe('PythonBridge Integration Tests', () => {
  // Resolve the path to the main.py python script
  const pythonScript = path.resolve(__dirname, '../../src-python/main.py');

  test('should successfully spawn the python process and receive telemetry data after state activation', () => {
    return new Promise<void>((resolve, reject) => {
      const bridge = new PythonBridge('python3', pythonScript);
      let telemetryCount = 0;

      bridge.on('message', (payload) => {
        if (payload.type === 'telemetry') {
          telemetryCount++;
          try {
            assert.ok(payload.data);
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

      // Trigger FOCUS state to activate camera/telemetry stream
      setTimeout(() => {
        bridge.sendCommand('change_state', { state: 'FOCUS' });
      }, 300);
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

  test('should stream camera status updates when transitioning states', () => {
    return new Promise<void>((resolve, reject) => {
      const bridge = new PythonBridge('python3', pythonScript);
      const receivedStatus: string[] = [];

      bridge.on('message', (payload) => {
        if (payload.type === 'status') {
          receivedStatus.push(payload.camera);
          
          if (payload.camera === 'opened') {
            // Once opened, request a transition to BREAK to trigger release
            bridge.sendCommand('change_state', { state: 'BREAK' });
          } else if (payload.camera === 'released') {
            // Once released, stop the bridge and complete the test
            bridge.stop();
          }
        }
      });

      bridge.on('close', (code) => {
        try {
          assert.strictEqual(code, 0);
          assert.deepStrictEqual(receivedStatus, ['opened', 'released']);
          resolve();
        } catch (e) {
          reject(e);
        }
      });

      bridge.on('error', (err) => {
        reject(err);
      });

      bridge.start();

      // Trigger transitions
      setTimeout(() => {
        bridge.sendCommand('change_state', { state: 'FOCUS' });
      }, 300);
    });
  });
});
