import axiosInstance from './axios';

export const sendAIChatMessage = async (payload) => {
  const response = await axiosInstance.post('/ai/chat', payload);
  return response.data;
};

export const sendAIVoiceTranscript = async (payload) => {
  const response = await axiosInstance.post('/ai/voice', payload);
  return response.data;
};

export const sendAIVoiceAudio = async ({ audioFile, sessionId, locale }) => {
  const formData = new FormData();
  formData.append('audio', audioFile);
  if (sessionId) formData.append('sessionId', sessionId);
  if (locale) formData.append('locale', locale);

  const response = await axiosInstance.post('/ai/voice', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });

  return response.data;
};

export const resetAISession = async (sessionId) => {
  const response = await axiosInstance.post('/ai/session/reset', { sessionId });
  return response.data;
};
