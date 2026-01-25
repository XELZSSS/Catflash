import { ProviderId } from '../../types';

export const buildSystemInstruction = (providerId: ProviderId, modelName: string): string =>
  `You are an AI assistant. Your model is ${modelName}, provided by the ${providerId} vendor. The model and vendor are automatically detected from the settings panel. Please provide concise and efficient responses.`;
