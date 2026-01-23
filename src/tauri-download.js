(() => {
  const panel = document.getElementById('tauri-download-panel');
  if (!panel) return;

  const urlInput = document.getElementById('tauri-download-url');
  const button = document.getElementById('tauri-download-btn');
  const status = document.getElementById('tauri-download-status');

  const setStatus = (text) => {
    if (status) status.textContent = text || '';
  };

  const appendStatus = (text) => {
    if (!status) return;
    const line = (text || '').toString().trim();
    if (!line) return;
    status.textContent = status.textContent
      ? status.textContent + '\n' + line
      : line;
  };

  const tauri = window.__TAURI__;
  const invoke = tauri && ((tauri.core && tauri.core.invoke) || tauri.invoke);
  const shell = tauri && (tauri.shell || (tauri.plugin && tauri.plugin.shell));
  const Command = shell && shell.Command;

  if (!tauri || !invoke || !Command) {
    setStatus('Tauri shell not available. Run inside the Tauri app.');
    return;
  }

  let lastSavedPath = '';

  button.addEventListener('click', async () => {
    const url = urlInput.value.trim();
    if (!url) {
      setStatus('Paste a valid URL.');
      return;
    }

    setStatus('Starting yt-dlp...');
    lastSavedPath = '';

    try {
      const downloadsDir = await invoke('ensure_downloads_dir');
      const safeDir = downloadsDir.replace(/[\\/]+$/, '');
      const outputTemplate = safeDir + '\\%(title)s.%(ext)s';

      appendStatus('Downloads: ' + safeDir);
      appendStatus('Template: ' + outputTemplate);

      const args = ['-f', 'bestaudio', '-o', outputTemplate, url];
      const command = Command.sidecar('binaries/yt-dlp', args);

      command.stdout.on('data', (line) => {
        appendStatus(line);
        const match = /Destination:\s(.+)/i.exec(line);
        if (match && match[1]) lastSavedPath = match[1].trim();
      });

      command.stderr.on('data', (line) => {
        appendStatus(line);
      });

      command.on('error', (error) => {
        appendStatus('Error: ' + (error && error.toString ? error.toString() : error));
      });

      command.on('close', (event) => {
        const code = event && typeof event.code === 'number' ? event.code : 'unknown';
        appendStatus('Exit code: ' + code);
        if (lastSavedPath) {
          appendStatus('Saved: ' + lastSavedPath);
        }
      });

      await command.spawn();
    } catch (error) {
      appendStatus('Error: ' + (error && error.toString ? error.toString() : error));
    }
  });
})();
