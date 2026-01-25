(() => {
  const overlay = document.getElementById('tauri-download-overlay');
  const panel = document.getElementById('tauri-download-panel');
  if (!overlay || !panel) return;

  const toggleBtn = document.getElementById('tauri-download-toggle');
  const minimizeBtn = document.getElementById('tauri-download-minimize');
  const closeBtn = document.getElementById('tauri-download-close');

  const urlInput = document.getElementById('tauri-download-url');
  const button = document.getElementById('tauri-download-btn');
  const statusEl = document.getElementById('tauri-download-status');
  const statusText = document.getElementById('tauri-download-status-text');
  const rootInput = document.getElementById('tauri-download-root');
  const rootSave = document.getElementById('tauri-download-root-save');

  const tauri = window.__TAURI__;
  const invoke = tauri && ((tauri.core && tauri.core.invoke) || tauri.invoke);
  const shell = tauri && (tauri.shell || (tauri.plugin && tauri.plugin.shell));
  const Command = shell && shell.Command;
  const ytDlpCandidates = (binariesDir) => ([
    `${binariesDir}\\yt-dlp-x86_64-pc-windows-msvc.exe`,
    `${binariesDir}\\yt-dlp.exe`
  ]);

  const showOverlay = () => {
    overlay.classList.add('is-visible');
  };

  const hideOverlay = () => {
    overlay.classList.remove('is-visible');
  };

  const setStatus = (state, message) => {
    if (!statusEl || !statusText) return;
    statusEl.classList.remove('is-success', 'is-error');
    panel.classList.remove('is-downloading');
    if (state === 'downloading') {
      panel.classList.add('is-downloading');
      statusText.textContent = message || 'Downloading';
      return;
    }
    if (state === 'success') {
      statusEl.classList.add('is-success');
      statusText.textContent = message || 'Ready: File imported.';
      return;
    }
    statusEl.classList.add('is-error');
    statusText.textContent = message || 'Download failed. See logs.';
  };

  const formatDateFolder = () => {
    const now = new Date();
    const yyyy = String(now.getFullYear());
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  const formatLogStamp = () => {
    const now = new Date();
    const yyyy = String(now.getFullYear());
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const hh = String(now.getHours()).padStart(2, '0');
    const mi = String(now.getMinutes()).padStart(2, '0');
    const ss = String(now.getSeconds()).padStart(2, '0');
    return `${yyyy}${mm}${dd}_${hh}${mi}${ss}`;
  };

  const looksLikeUrl = (value) => /^https?:\/\/.+/i.test(value);

  const init = async () => {
    hideOverlay();
    if (!tauri || !invoke || !Command) {
      setStatus('error');
      if (button) button.disabled = true;
      return;
    }

    try {
      const root = await invoke('get_download_root');
      if (rootInput) rootInput.value = root;
    } catch (_) {
      setStatus('error');
    }
  };

  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      showOverlay();
    });
  }

  if (minimizeBtn) {
    minimizeBtn.addEventListener('click', () => {
      hideOverlay();
    });
  }

  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      hideOverlay();
    });
  }

  if (rootSave && rootInput) {
    rootSave.addEventListener('click', async () => {
      if (!invoke) return;
      const value = rootInput.value.trim();
      try {
        const updated = await invoke('set_download_root', { path: value });
        rootInput.value = updated;
        setStatus('success');
      } catch (_) {
        setStatus('error');
      }
    });
  }

  let isDownloading = false;

  if (button) {
    button.addEventListener('click', async () => {
      if (isDownloading) return;
      const url = urlInput.value.trim();
      if (!looksLikeUrl(url)) {
        setStatus('error');
        return;
      }

      if (!invoke || !Command) {
        setStatus('error');
        return;
      }

      isDownloading = true;
      button.disabled = true;
      setStatus('downloading');

      const dateFolder = formatDateFolder();
      const logStamp = formatLogStamp();
      let downloadDir = '';
      let logPath = '';
      const logLines = [];
      let spawnError = '';
      let downloadPath = '';
      let binariesDir = '';
      let chosenYtDlpPath = '';
      const suppressWarnings = window.localStorage
        && window.localStorage.getItem('aw_ytdlp_no_warnings') === '1';

      try {
        downloadDir = await invoke('ensure_downloads_dir', { dateFolder });
        logPath = `${downloadDir}\\download_${logStamp}.log`;

        binariesDir = await invoke('get_binaries_dir');
        logLines.push(`[diag] binariesDir=${binariesDir}`);
        const outputTemplate = `${downloadDir}\\%(uploader)s__%(title)s__%(id)s.%(ext)s`;
        const args = [
          '--ignore-config',
          '--ffmpeg-location', binariesDir,
          '-f', 'bestaudio',
          '-x',
          '--audio-format', 'm4a',
          '--audio-quality', '0',
          '--windows-filenames',
          '-o', outputTemplate,
          '--print', 'after_move:filepath',
          url
        ];
        if (suppressWarnings) {
          args.splice(1, 0, '--no-warnings');
        }

        logLines.push('[diag] using Command.sidecar name=binaries/yt-dlp');
        const command = Command.sidecar('binaries/yt-dlp', args);
        chosenYtDlpPath = 'sidecar:binaries/yt-dlp';

        command.stdout.on('data', (line) => {
          if (line) logLines.push(line.toString());
          const trimmed = (line || '').toString().trim();
          if (trimmed && downloadDir && trimmed.toLowerCase().startsWith(downloadDir.toLowerCase())) {
            downloadPath = trimmed;
          }
        });

        command.stderr.on('data', (line) => {
          if (line) logLines.push(line.toString());
        });

        command.on('error', (error) => {
          spawnError = error && error.toString ? error.toString() : String(error || '');
          logLines.push(`[diag] command.on_error path=${chosenYtDlpPath} err=${spawnError}`);
        });

        command.on('close', async (event) => {
          const code = event && typeof event.code === 'number' ? event.code : 1;
          logLines.push(`[diag] command.on_close code=${code} path=${chosenYtDlpPath}`);
          let resolvedPath = downloadPath;
          if (code === 0 && (!resolvedPath || !resolvedPath.toLowerCase().endsWith('.m4a'))) {
            try {
              resolvedPath = await invoke('find_latest_download', { downloadDir });
              logLines.push(`[diag] resolved_download=${resolvedPath}`);
            } catch (resolveErr) {
              logLines.push(`[diag] resolve_download_error=${String(resolveErr || '')}`);
            }
          }

          const logText = logLines.join('\n') + (spawnError ? `\n${spawnError}` : '');

          if (logPath) {
            try {
              await invoke('write_download_log', { path: logPath, contents: logText });
            } catch (_) {}
          }

          const isM4a = resolvedPath && resolvedPath.toLowerCase().endsWith('.m4a');

          if (code === 0 && isM4a) {
            try {
              const bytes = await invoke('read_downloaded_file', { path: resolvedPath });
              const blob = new Blob([new Uint8Array(bytes)], { type: 'audio/mp4' });
              if (window.PKAudioEditor && window.PKAudioEditor.engine) {
                window.PKAudioEditor.engine.LoadArrayBuffer(blob);
              }
              const sizeMb = bytes && bytes.length ? (bytes.length / (1024 * 1024)) : 0;
              const sizeText = sizeMb ? ` (${sizeMb.toFixed(1)} MB)` : '';
              setStatus('success', `Ready: File imported.${sizeText}`);
            } catch (_) {
              setStatus('error');
            }
          } else {
            setStatus('error');
          }

          isDownloading = false;
          button.disabled = false;
        });

        await command.spawn();
        logLines.push(`[diag] spawn_called path=${chosenYtDlpPath}`);
      } catch (error) {
        if (logPath) {
          try {
            const errText = String(error || '');
            const diagText = logLines.length ? `\n${logLines.join('\n')}` : '';
            await invoke('write_download_log', { path: logPath, contents: `${errText}${diagText}` });
          } catch (_) {}
        }
        setStatus('error');
        isDownloading = false;
        button.disabled = false;
      }
    });
  }

  init();
})();
