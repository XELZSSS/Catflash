import React from 'react';
import { ProviderId } from '../../types';
import { t } from '../../utils/i18n';
import { ImageGenerationConfig } from '../../services/providers/types';
import Dropdown, { DropdownOption } from '../settings/Dropdown';
import {
  fullInputClass,
  getImageAspectRatioOptions,
  getImageCountOptions,
  getImageQualityOptions,
  getImageSizeOptions,
} from './constants';
import { Input } from '../ui';

type ImageTabProps = {
  providerId: ProviderId;
  imageGeneration: ImageGenerationConfig;
  portalContainer: HTMLElement | null;
  onSetImageSize: (value: string) => void;
  onSetImageAspectRatio: (value: string) => void;
  onSetImageCount: (value: string) => void;
  onSetImageQuality: (value: string) => void;
  onSetImageSubjectReference: (value: string) => void;
};

const ensureOption = (options: DropdownOption[], value?: string): DropdownOption[] => {
  const nextValue = value?.trim();
  if (!nextValue) return options;
  if (options.some((option) => option.value === nextValue)) return options;
  return [...options, { value: nextValue, label: `${nextValue}` }];
};

const ImageTab: React.FC<ImageTabProps> = ({
  providerId,
  imageGeneration,
  portalContainer,
  onSetImageSize,
  onSetImageAspectRatio,
  onSetImageCount,
  onSetImageQuality,
  onSetImageSubjectReference,
}) => {
  const imageSizeOptions = ensureOption(getImageSizeOptions(providerId), imageGeneration.size);
  const imageAspectRatioOptions = ensureOption(
    getImageAspectRatioOptions(providerId),
    imageGeneration.aspectRatio
  );
  const imageCountOptions = ensureOption(
    getImageCountOptions(),
    imageGeneration.count !== undefined ? String(imageGeneration.count) : undefined
  );
  const imageQualityOptions = ensureOption(
    getImageQualityOptions(providerId),
    imageGeneration.quality
  );

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div className="space-y-1">
          <label className="text-xs text-[var(--ink-3)]">{t('settings.modal.image.size')}</label>
          <Dropdown
            value={imageGeneration.size ?? imageSizeOptions[0]?.value ?? '1024x1024'}
            options={imageSizeOptions}
            onChange={onSetImageSize}
            widthClassName="w-full"
            portalContainer={portalContainer}
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-[var(--ink-3)]">
            {t('settings.modal.image.aspectRatio')}
          </label>
          <Dropdown
            value={imageGeneration.aspectRatio ?? imageAspectRatioOptions[0]?.value ?? '1:1'}
            options={imageAspectRatioOptions}
            onChange={onSetImageAspectRatio}
            widthClassName="w-full"
            portalContainer={portalContainer}
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-[var(--ink-3)]">{t('settings.modal.image.count')}</label>
          <Dropdown
            value={String(imageGeneration.count ?? imageCountOptions[0]?.value ?? '1')}
            options={imageCountOptions}
            onChange={onSetImageCount}
            widthClassName="w-full"
            portalContainer={portalContainer}
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-[var(--ink-3)]">{t('settings.modal.image.quality')}</label>
          <Dropdown
            value={imageGeneration.quality ?? imageQualityOptions[0]?.value ?? 'auto'}
            options={imageQualityOptions}
            onChange={onSetImageQuality}
            widthClassName="w-full"
            portalContainer={portalContainer}
          />
        </div>
      </div>
      <label className="text-xs text-[var(--ink-3)]">
        {t('settings.modal.image.subjectReference')}
      </label>
      <Input
        type="text"
        value={imageGeneration.subjectReference ?? ''}
        onChange={(event) => onSetImageSubjectReference(event.target.value)}
        placeholder={t('settings.modal.image.subjectReference.placeholder')}
        className={fullInputClass}
        compact
        autoComplete="off"
      />
    </div>
  );
};

export default ImageTab;
