import 'cross-fetch/polyfill';
import apiClient from '../services/apiClient';
import { v4 as uuidv4 } from 'uuid';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://10.0.2.2:8000';

function logStep(type: string, ...args: any[]) {
  console.log(`[JARVIS][${type}]`, ...args);
}

describe('Jarvis Backend Pipeline E2E', () => {
  let userId: string;
  let conversationId: string;

  beforeAll(() => {
    userId = uuidv4();
    logStep('INFO', 'Generated test userId', userId);
  });

  test('Health check', async () => {
    logStep('REQUEST', `${BASE_URL}/health`);
    try {
      const res = await apiClient.checkHealth();
      logStep('RESPONSE', 'health', res);
      expect(['ok', 'healthy']).toContain(res.status);
    } catch (error) {
      logStep('ERROR', 'health', error);
      throw error;
    }
  });

  test('Create/Get User', async () => {
    logStep('REQUEST', `${BASE_URL}/api/v1/users/${userId}`);
    try {
      const user = await apiClient.getOrCreateUser(userId);
      logStep('RESPONSE', 'user', user);
      expect(user.id).toBe(userId);
    } catch (error) {
      logStep('ERROR', 'user', error);
      throw error;
    }
  });

  test('Create Conversation', async () => {
    logStep('REQUEST', `${BASE_URL}/api/v1/conversations`);
    try {
      const conv = await apiClient.createConversation(userId);
      logStep('RESPONSE', 'conversation', conv);
      conversationId = conv.id;
      expect(conv.user_id).toBe(userId);
      expect(typeof conv.created_at).toBe('string');
    } catch (error) {
      logStep('ERROR', 'conversation', error);
      throw error;
    }
  });

  test('Send Message', async () => {
    logStep('REQUEST', `${BASE_URL}/api/v1/messages`);
    try {
      const msg = await apiClient.sendMessage({
        conversationId,
        role: 'user',
        content: 'Hello Jarvis!',
      });
      logStep('RESPONSE', 'message', msg);
      expect(msg.conversation_id).toBe(conversationId);
    } catch (error) {
      logStep('ERROR', 'message', error);
      throw error;
    }
  });

  test('Get Messages', async () => {
    logStep('REQUEST', `${BASE_URL}/api/v1/conversations/${conversationId}/messages`);
    try {
      const msgs = await apiClient.getMessages(conversationId);
      logStep('RESPONSE', 'messages', msgs);
      expect(Array.isArray(msgs)).toBe(true);
    } catch (error) {
      logStep('ERROR', 'messages', error);
      throw error;
    }
  });

  test('Search Memory', async () => {
    logStep('REQUEST', `${BASE_URL}/api/v1/memory/search`);
    try {
      const results = await apiClient.searchMemory(userId, 'test');
      logStep('RESPONSE', 'memory', results);
      expect(Array.isArray(results)).toBe(true);
    } catch (error) {
      logStep('ERROR', 'memory', error);
      throw error;
    }
  });

  test('Get Working Memory', async () => {
    logStep('REQUEST', `${BASE_URL}/api/v1/memory/working/${userId}`);
    try {
      const mem = await apiClient.getWorkingMemory(userId);
      logStep('RESPONSE', 'workingMemory', mem);
      expect(typeof mem).toBe('object');
    } catch (error) {
      logStep('ERROR', 'workingMemory', error);
      throw error;
    }
  });

  test('Process Query', async () => {
    logStep('REQUEST', `${BASE_URL}/api/v1/ai/process`);
    try {
      const result = await apiClient.processQuery(userId, 'What is the weather?');
      logStep('RESPONSE', 'aiProcess', result);
      expect(typeof result.response).toBe('string');
    } catch (error) {
      logStep('ERROR', 'aiProcess', error);
      throw error;
    }
  });
});
