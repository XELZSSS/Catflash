import { useCallback, useMemo, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { ChatMessage, Role } from '../types';
import { t } from '../utils/i18n';
import { insertUnderHeading } from '../utils/obsidian';

type UseObsidianActionsOptions = {
  obsidianSettings: import('../types').ObsidianSettings;
  messages: ChatMessage[];
  setMessages: Dispatch<SetStateAction<ChatMessage[]>>;
  handleSendMessage: (text: string) => Promise<void>;
};

export const useObsidianActions = ({
  obsidianSettings,
  messages,
  setMessages,
  handleSendMessage,
}: UseObsidianActionsOptions) => {
  const [obsidianBusy, setObsidianBusy] = useState(false);

  const obsidianAvailable = useMemo(() => {
    return obsidianSettings.mode === 'plugin'
      ? Boolean(obsidianSettings.apiUrl)
      : typeof window !== 'undefined' && !!window.gero?.obsidian;
  }, [obsidianSettings.apiUrl, obsidianSettings.mode]);

  const pushObsidianMessage = useCallback(
    (text: string, isError = false) => {
      setMessages((prev) => [
        ...prev,
        {
          id: uuidv4(),
          role: Role.Model,
          text,
          timestamp: Date.now(),
          isError,
        },
      ]);
    },
    [setMessages]
  );

  const getObsidianApiConfig = useCallback(() => {
    const baseUrl = obsidianSettings.apiUrl?.trim();
    if (!baseUrl) {
      throw new Error('Missing Obsidian API URL');
    }
    return {
      baseUrl: baseUrl.replace(/\/+$/, ''),
      headers: obsidianSettings.apiKey
        ? { Authorization: `Bearer ${obsidianSettings.apiKey}` }
        : undefined,
    };
  }, [obsidianSettings.apiKey, obsidianSettings.apiUrl]);

  const fetchObsidianApi = useCallback(
    async (path: string, init?: RequestInit) => {
      const { baseUrl, headers } = getObsidianApiConfig();
      const response = await fetch(`${baseUrl}${path}`, {
        ...init,
        headers: {
          ...(headers ?? {}),
          ...(init?.headers ?? {}),
        },
      });
      if (!response.ok) {
        throw new Error(`Obsidian API error: ${response.status}`);
      }
      return response;
    },
    [getObsidianApiConfig]
  );

  const getActiveNote = useCallback(async () => {
    const response = await fetchObsidianApi('/active/', {
      headers: { Accept: 'application/vnd.olrapi.note+json' },
    });
    const payload = (await response.json()) as {
      path?: string;
      content?: string;
      data?: string;
      text?: string;
    };
    return {
      path: payload.path ?? '',
      content: payload.content ?? payload.data ?? payload.text ?? '',
    };
  }, [fetchObsidianApi]);

  const resolveObsidianNotePath = useCallback(async (): Promise<string | null> => {
    if (obsidianSettings.mode === 'plugin') {
      if (obsidianSettings.readMode === 'active') {
        const active = await getActiveNote();
        return active.path || null;
      }
      return obsidianSettings.notePath?.trim() || null;
    }
    if (!obsidianSettings.vaultPath) return null;
    if (obsidianSettings.readMode === 'recent') {
      if (!window.gero?.obsidian?.getRecentNote) return null;
      return window.gero.obsidian.getRecentNote(obsidianSettings.vaultPath);
    }
    return obsidianSettings.notePath?.trim() || null;
  }, [
    getActiveNote,
    obsidianSettings.mode,
    obsidianSettings.notePath,
    obsidianSettings.readMode,
    obsidianSettings.vaultPath,
  ]);

  const handleReadObsidian = useCallback(async () => {
    if (obsidianBusy) return;
    setObsidianBusy(true);
    try {
      if (obsidianSettings.mode === 'plugin') {
        if (!obsidianSettings.apiUrl) {
          pushObsidianMessage(t('obsidian.error.noApiUrl'), true);
          return;
        }
        const notePath = await resolveObsidianNotePath();
        if (!notePath) {
          pushObsidianMessage(t('obsidian.error.noNote'), true);
          return;
        }
        const content =
          obsidianSettings.readMode === 'active'
            ? (await getActiveNote()).content
            : await (await fetchObsidianApi(`/vault/${encodeURIComponent(notePath)}`)).text();
        const prompt = `${t('obsidian.prompt.prefix')}: ${notePath}\n\n${content}`;
        await handleSendMessage(prompt);
        return;
      }

      if (!obsidianSettings.vaultPath) {
        pushObsidianMessage(t('obsidian.error.noVault'), true);
        return;
      }
      if (!window.gero?.obsidian?.readNote) {
        pushObsidianMessage(t('obsidian.error.readFailed'), true);
        return;
      }
      const notePath = await resolveObsidianNotePath();
      if (!notePath) {
        pushObsidianMessage(t('obsidian.error.noNote'), true);
        return;
      }
      const content = await window.gero.obsidian.readNote(obsidianSettings.vaultPath, notePath);
      const prompt = `${t('obsidian.prompt.prefix')}: ${notePath}\n\n${content}`;
      await handleSendMessage(prompt);
    } catch (error) {
      console.error('Failed to read Obsidian note:', error);
      pushObsidianMessage(t('obsidian.error.readFailed'), true);
    } finally {
      setObsidianBusy(false);
    }
  }, [
    fetchObsidianApi,
    getActiveNote,
    handleSendMessage,
    obsidianBusy,
    obsidianSettings.apiUrl,
    obsidianSettings.mode,
    obsidianSettings.readMode,
    obsidianSettings.vaultPath,
    pushObsidianMessage,
    resolveObsidianNotePath,
  ]);

  const handleWriteObsidian = useCallback(async () => {
    if (obsidianBusy) return;
    const lastReply = [...messages]
      .reverse()
      .find((msg) => msg.role === Role.Model && !msg.isError)?.text;
    if (!lastReply) {
      pushObsidianMessage(t('obsidian.error.noReply'), true);
      return;
    }
    setObsidianBusy(true);
    try {
      if (obsidianSettings.mode === 'plugin') {
        if (!obsidianSettings.apiUrl) {
          pushObsidianMessage(t('obsidian.error.noApiUrl'), true);
          return;
        }
        const notePath = await resolveObsidianNotePath();
        if (!notePath) {
          pushObsidianMessage(t('obsidian.error.noNote'), true);
          return;
        }
        const activeNote =
          obsidianSettings.readMode === 'active' ? await getActiveNote() : undefined;
        const current =
          activeNote?.content ??
          (await (await fetchObsidianApi(`/vault/${encodeURIComponent(notePath)}`)).text());
        const trimmedReply = lastReply.trim();
        let nextContent = current;
        if (obsidianSettings.writeMode === 'replace') {
          nextContent = `${trimmedReply}\n`;
        } else if (obsidianSettings.writeMode === 'append') {
          nextContent = `${current.trimEnd()}\n\n${trimmedReply}\n`;
        } else {
          nextContent = insertUnderHeading(current, obsidianSettings.writeHeading, trimmedReply);
        }

        if (obsidianSettings.previewBeforeWrite) {
          const preview =
            nextContent.length > 1200 ? `${nextContent.slice(0, 1200)}...` : nextContent;
          const confirmed = window.confirm(`${t('obsidian.confirm.write')}\n\n${preview}`);
          if (!confirmed) {
            return;
          }
        }

        await fetchObsidianApi(`/vault/${encodeURIComponent(notePath)}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'text/markdown' },
          body: nextContent,
        });
        pushObsidianMessage(`${t('obsidian.info.saved')} ${notePath}`);
        return;
      }

      if (!obsidianSettings.vaultPath) {
        pushObsidianMessage(t('obsidian.error.noVault'), true);
        return;
      }
      if (!window.gero?.obsidian?.readNote || !window.gero?.obsidian?.writeNote) {
        pushObsidianMessage(t('obsidian.error.writeFailed'), true);
        return;
      }
      const notePath = await resolveObsidianNotePath();
      if (!notePath) {
        pushObsidianMessage(t('obsidian.error.noNote'), true);
        return;
      }
      const current = await window.gero.obsidian.readNote(obsidianSettings.vaultPath, notePath);
      const trimmedReply = lastReply.trim();
      let nextContent = current;
      if (obsidianSettings.writeMode === 'replace') {
        nextContent = `${trimmedReply}\n`;
      } else if (obsidianSettings.writeMode === 'append') {
        nextContent = `${current.trimEnd()}\n\n${trimmedReply}\n`;
      } else {
        nextContent = insertUnderHeading(current, obsidianSettings.writeHeading, trimmedReply);
      }

      if (obsidianSettings.previewBeforeWrite) {
        const preview =
          nextContent.length > 1200 ? `${nextContent.slice(0, 1200)}...` : nextContent;
        const confirmed = window.confirm(`${t('obsidian.confirm.write')}\n\n${preview}`);
        if (!confirmed) {
          return;
        }
      }

      await window.gero.obsidian.writeNote(obsidianSettings.vaultPath, notePath, nextContent);
      pushObsidianMessage(`${t('obsidian.info.saved')} ${notePath}`);
    } catch (error) {
      console.error('Failed to write Obsidian note:', error);
      pushObsidianMessage(t('obsidian.error.writeFailed'), true);
    } finally {
      setObsidianBusy(false);
    }
  }, [
    fetchObsidianApi,
    getActiveNote,
    messages,
    obsidianBusy,
    obsidianSettings.apiUrl,
    obsidianSettings.mode,
    obsidianSettings.previewBeforeWrite,
    obsidianSettings.readMode,
    obsidianSettings.vaultPath,
    obsidianSettings.writeHeading,
    obsidianSettings.writeMode,
    pushObsidianMessage,
    resolveObsidianNotePath,
  ]);

  return {
    obsidianAvailable,
    obsidianBusy,
    handleReadObsidian,
    handleWriteObsidian,
  };
};
