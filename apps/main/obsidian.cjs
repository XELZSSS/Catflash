const { ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

const normalizeVaultPath = (vaultPath) => {
  if (!vaultPath || typeof vaultPath !== 'string') {
    throw new Error('Missing Obsidian vault path');
  }
  return path.resolve(vaultPath);
};

const resolveNotePath = (vaultRoot, notePath) => {
  if (!notePath || typeof notePath !== 'string') {
    throw new Error('Missing Obsidian note path');
  }
  const resolvedVault = normalizeVaultPath(vaultRoot);
  const resolvedNote = path.isAbsolute(notePath)
    ? path.resolve(notePath)
    : path.resolve(resolvedVault, notePath);
  const normalizedVault = resolvedVault.endsWith(path.sep)
    ? resolvedVault
    : `${resolvedVault}${path.sep}`;
  if (!resolvedNote.startsWith(normalizedVault)) {
    throw new Error('Note path must be inside the vault');
  }
  return { vault: resolvedVault, note: resolvedNote };
};

const listMarkdownFiles = async (vaultPath) => {
  const root = normalizeVaultPath(vaultPath);
  const results = [];
  const stack = [root];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) continue;
    const entries = await fs.promises.readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name === '.obsidian') continue;
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
        continue;
      }
      if (!entry.isFile()) continue;
      const lower = entry.name.toLowerCase();
      if (!lower.endsWith('.md') && !lower.endsWith('.markdown')) continue;
      results.push(fullPath);
    }
  }
  return results;
};

const registerObsidianIpcHandlers = () => {
  ipcMain.handle('obsidian:list-markdown', async (_event, vaultPath) => {
    const files = await listMarkdownFiles(vaultPath);
    const root = normalizeVaultPath(vaultPath);
    return files
      .map((filePath) => path.relative(root, filePath))
      .sort((a, b) => a.localeCompare(b));
  });
  ipcMain.handle('obsidian:get-recent-note', async (_event, vaultPath) => {
    const files = await listMarkdownFiles(vaultPath);
    if (files.length === 0) return null;
    const stats = await Promise.all(
      files.map(async (filePath) => ({
        filePath,
        stat: await fs.promises.stat(filePath),
      }))
    );
    stats.sort((a, b) => b.stat.mtimeMs - a.stat.mtimeMs);
    const root = normalizeVaultPath(vaultPath);
    return path.relative(root, stats[0].filePath);
  });
  ipcMain.handle('obsidian:read-note', async (_event, payload) => {
    const { vaultPath, notePath } = payload ?? {};
    const resolved = resolveNotePath(vaultPath, notePath);
    return fs.promises.readFile(resolved.note, 'utf-8');
  });
  ipcMain.handle('obsidian:write-note', async (_event, payload) => {
    const { vaultPath, notePath, content } = payload ?? {};
    const resolved = resolveNotePath(vaultPath, notePath);
    await fs.promises.mkdir(path.dirname(resolved.note), { recursive: true });
    await fs.promises.writeFile(resolved.note, content ?? '', 'utf-8');
  });
};

module.exports = {
  registerObsidianIpcHandlers,
};
