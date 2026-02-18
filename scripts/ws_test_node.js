#!/usr/bin/env node
// Usage: node ws_test_node.js
// npm install ws

const WebSocket = require('ws');

const WS_URL = process.env.BACKEND_WS || 'ws://localhost:8000/api/v1/ws/voice/1';

const ws = new WebSocket(WS_URL);

ws.on('open', () => {
  console.log('connected ->', WS_URL);
  // Trigger pipeline (no audio): send final control frame
  ws.send(JSON.stringify({ type: 'final' }));
});

ws.on('message', (data) => {
  try {
    const msg = JSON.parse(data.toString());
    console.log('recv:', msg);
    if (msg.type === 'context_built' || (msg.type === 'context_built' && msg.ms)) {
      console.log(`Context build latency: ${msg.ms} ms`);
      ws.close();
    }
  } catch (e) {
    console.log('raw:', data.toString());
  }
});

ws.on('close', () => console.log('socket closed'));
ws.on('error', (err) => console.error('socket error', err));
