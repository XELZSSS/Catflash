import { useCallback, useEffect, useRef } from 'react';
import type { Dispatch, KeyboardEvent } from 'react';
import { SettingsModalAction, SettingsModalState } from './reducer';

type UseObsidianToolsOptions = {
  state: SettingsModalState;
  dispatch: Dispatch<SettingsModalAction>;
  isOpen: boolean;
};

type ObsidianSearchResult = {
  path?: unknown;
  filename?: unknown;
  file?: unknown;
  name?: unknown;
};

const extractResultPath = (item: ObsidianSearchResult): string => {
  const candidate = item.path ?? item.filename ?? item.file ?? item.name ?? '';
  return String(candidate);
};

export const useObsidianTools = ({ state, dispatch, isOpen }: UseObsidianToolsOptions) => {
  const obsidianNotePathRef = useRef<HTMLInputElement>(null);

  const refreshObsidianNotes = useCallback(async () => {
    if (
      state.obsidianMode !== 'vault' ||
      !state.obsidianVaultPath ||
      !window.gero?.obsidian?.listMarkdown
    ) {
      dispatch({ type: 'patch', payload: { obsidianNotes: [] } });
      return;
    }
    dispatch({ type: 'patch', payload: { obsidianNotesLoading: true } });
    try {
      const notes = await window.gero.obsidian.listMarkdown(state.obsidianVaultPath);
      dispatch({ type: 'patch', payload: { obsidianNotes: notes ?? [] } });
    } catch (error) {
      console.error('Failed to load Obsidian notes:', error);
      dispatch({ type: 'patch', payload: { obsidianNotes: [] } });
    } finally {
      dispatch({ type: 'patch', payload: { obsidianNotesLoading: false } });
    }
  }, [dispatch, state.obsidianMode, state.obsidianVaultPath]);

  useEffect(() => {
    if (!isOpen) return;
    refreshObsidianNotes();
  }, [isOpen, refreshObsidianNotes]);

  const handleTestObsidianApi = useCallback(async () => {
    if (!state.obsidianApiUrl) return;
    dispatch({ type: 'patch', payload: { obsidianTesting: true, obsidianTestStatus: 'idle' } });
    try {
      const response = await fetch(`${state.obsidianApiUrl.replace(/\/+$/, '')}/`, {
        headers: state.obsidianApiKey
          ? { Authorization: `Bearer ${state.obsidianApiKey}` }
          : undefined,
      });
      dispatch({ type: 'patch', payload: { obsidianTestStatus: response.ok ? 'ok' : 'fail' } });
    } catch (error) {
      console.error('Failed to test Obsidian API:', error);
      dispatch({ type: 'patch', payload: { obsidianTestStatus: 'fail' } });
    } finally {
      dispatch({ type: 'patch', payload: { obsidianTesting: false } });
    }
  }, [dispatch, state.obsidianApiKey, state.obsidianApiUrl]);

  const handleSearchObsidianNotes = useCallback(async () => {
    if (!state.obsidianApiUrl || !state.obsidianSearchQuery.trim()) {
      dispatch({ type: 'patch', payload: { obsidianSearchResults: [] } });
      return;
    }
    dispatch({ type: 'patch', payload: { obsidianSearchLoading: true } });
    try {
      const response = await fetch(
        `${state.obsidianApiUrl.replace(/\/+$/, '')}/search/simple/?query=${encodeURIComponent(
          state.obsidianSearchQuery.trim()
        )}`,
        {
          method: 'POST',
          headers: state.obsidianApiKey
            ? { Authorization: `Bearer ${state.obsidianApiKey}` }
            : undefined,
        }
      );
      if (!response.ok) throw new Error(`Search failed: ${response.status}`);
      const payload = (await response.json()) as { results?: ObsidianSearchResult[] };
      const paths = (Array.isArray(payload.results) ? payload.results : [])
        .map(extractResultPath)
        .filter((value) => value && value !== 'undefined')
        .slice(0, 20);
      dispatch({ type: 'patch', payload: { obsidianSearchResults: paths } });
    } catch (error) {
      console.error('Failed to search Obsidian notes:', error);
      dispatch({ type: 'patch', payload: { obsidianSearchResults: [] } });
    } finally {
      dispatch({ type: 'patch', payload: { obsidianSearchLoading: false } });
    }
  }, [dispatch, state.obsidianApiKey, state.obsidianApiUrl, state.obsidianSearchQuery]);

  const handleObsidianSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    handleSearchObsidianNotes();
  };

  return {
    obsidianNotePathRef,
    refreshObsidianNotes,
    handleTestObsidianApi,
    handleSearchObsidianNotes,
    handleObsidianSearchKeyDown,
  };
};
