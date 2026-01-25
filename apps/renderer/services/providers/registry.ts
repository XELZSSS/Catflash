import { ProviderId } from '../../types';
import { deepseekProviderDefinition } from './deepseekProvider';
import { geminiProviderDefinition } from './geminiProvider';
import { glmProviderDefinition } from './glmProvider';
import { minimaxProviderDefinition } from './minimaxProvider';
import { moonshotProviderDefinition } from './moonshotProvider';
import { iflowProviderDefinition } from './iflowProvider';
import { openaiProviderDefinition } from './openaiProvider';
import { openaiCompatibleProviderDefinition } from './openaiCompatibleProvider';
import { xaiProviderDefinition } from './xaiProvider';
import { ProviderChat, ProviderDefinition } from './types';

const definitions: Record<ProviderId, ProviderDefinition> = {
  gemini: geminiProviderDefinition,
  openai: openaiProviderDefinition,
  'openai-compatible': openaiCompatibleProviderDefinition,
  xai: xaiProviderDefinition,
  deepseek: deepseekProviderDefinition,
  glm: glmProviderDefinition,
  minimax: minimaxProviderDefinition,
  moonshot: moonshotProviderDefinition,
  iflow: iflowProviderDefinition,
};

export const getProviderDefinition = (id: ProviderId): ProviderDefinition => {
  return definitions[id];
};

export const createProvider = (id: ProviderId): ProviderChat => {
  return getProviderDefinition(id).create();
};

export const listProviderIds = (): ProviderId[] => {
  return Object.keys(definitions) as ProviderId[];
};

export const getProviderModels = (id: ProviderId): string[] => {
  return getProviderDefinition(id).models;
};

export const getProviderDefaultModel = (id: ProviderId): string => {
  return getProviderDefinition(id).defaultModel;
};
