import { ImageGenerationResult } from './types';

type ImageDataItem = {
  url?: string;
  b64_json?: string;
  revised_prompt?: string;
};

type ImageResponsePayload = {
  data?: ImageDataItem[];
  image_urls?: string[];
};

export const parseImageGenerationResponse = (
  payload: ImageResponsePayload,
  emptyImageErrorMessage: string
): ImageGenerationResult => {
  const first = payload.data?.[0];
  const imageUrl = first?.url ?? payload.image_urls?.[0];
  const imageDataUrl = first?.b64_json ? `data:image/png;base64,${first.b64_json}` : undefined;

  if (!imageUrl && !imageDataUrl) {
    throw new Error(emptyImageErrorMessage);
  }

  return {
    imageUrl,
    imageDataUrl,
    revisedPrompt: first?.revised_prompt,
  };
};

