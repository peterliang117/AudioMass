// UI CONTRACT: Only these controls are allowed in this panel:
// - URL input
// - Download button
// - Optional path selector
// - Status text
// - ONE window control (minimize or close)
// No other buttons may appear without explicit owner approval.
(() => {
  if (window.__audioWorkshopDownloadUI) return;
  window.__audioWorkshopDownloadUI = true;

  const mount = document.getElementById('tauri-download-mount') || document.body;
  const container = document.createElement('div');
  container.id = 'tauri-download-container';
  mount.appendChild(container);

  class DownloadPanel extends HTMLElement {
    constructor() {
      super();
      this._state = 'idle';
      this._message = '';
      this._shadow = this.attachShadow({ mode: 'closed' });
      this._shadow.innerHTML = this._template();

      this._elements = {
        overlay: this._shadow.getElementById('overlay'),
        panel: this._shadow.getElementById('panel'),
        openBtn: this._shadow.getElementById('open-btn'),
        minimizeBtn: this._shadow.getElementById('minimize-btn'),
        downloadBtn: this._shadow.getElementById('download-btn'),
        stopBtn: this._shadow.getElementById('stop-btn'),
        urlInput: this._shadow.getElementById('url-input'),
        rootInput: this._shadow.getElementById('root-input'),
        rootSave: this._shadow.getElementById('root-save'),
        rootBrowse: this._shadow.getElementById('root-browse'),
        playlistToggle: this._shadow.getElementById('playlist-toggle'),
        statusText: this._shadow.getElementById('status-text'),
        spinner: this._shadow.getElementById('spinner')
      };

      this._wire();
      this._initRoot();

      const hasShown = window.localStorage && window.localStorage.getItem('aw_download_ui_seen') === '1';
      if (!hasShown) {
        this.show();
        if (window.localStorage) window.localStorage.setItem('aw_download_ui_seen', '1');
      } else {
        this.hide();
      }
    }

    show() {
      this._elements.overlay.style.display = 'block';
      if (this._elements.urlInput) this._elements.urlInput.focus();
    }

    hide() {
      this._elements.overlay.style.display = 'none';
    }

    setStatus(state, message) {
      const nextState = state || 'idle';
      this._state = nextState;
      this._message = message || '';
      const { statusText, panel, spinner } = this._elements;
      if (!statusText || !panel || !spinner) return;

      panel.classList.remove('is-success', 'is-error');
      if (nextState === 'downloading') {
        spinner.style.display = 'inline-block';
        statusText.textContent = message || 'Downloading';
        return;
      }

      spinner.style.display = 'none';
      if (nextState === 'success') {
        panel.classList.add('is-success');
        statusText.textContent = message || 'Ready: File imported.';
        return;
      }

      if (nextState === 'error') {
        panel.classList.add('is-error');
        statusText.textContent = message || 'Download failed. See logs.';
        return;
      }

      statusText.textContent = message || '';
    }

    _template() {
      return `
<style>
  :host {
    all: initial;
  }
  #overlay {
    position: fixed;
    top: 8px;
    right: 8px;
    z-index: 9999;
    display: none;
    font-family: Arial, Helvetica, sans-serif;
    font-size: 12px;
    color: #eee;
  }
  #panel {
    width: 320px;
    background: rgba(20,20,20,0.95);
    border: 1px solid #3a3a3a;
    border-radius: 8px;
    padding: 10px;
    box-sizing: border-box;
  }
  #header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    margin-bottom: 6px;
  }
  #title {
    font-weight: bold;
  }
  #controls {
    display: flex;
    gap: 6px;
  }
  #controls button {
    background: #1d1d1d;
    color: #eee;
    border: 1px solid #444;
    border-radius: 6px;
    width: 22px;
    height: 22px;
    cursor: pointer;
    line-height: 18px;
    padding: 0;
  }
  #controls button:hover {
    background: #2d2d2d;
  }
  .row {
    display: flex;
    gap: 6px;
    margin-top: 6px;
    flex-wrap: wrap;
  }
  .row:first-of-type {
    margin-top: 0;
  }
  input {
    flex: 1;
    background: #151515;
    color: #eee;
    border: 1px solid #444;
    border-radius: 6px;
    padding: 4px 6px;
    font-size: 12px;
    box-sizing: border-box;
  }
  button.action {
    background: #2c2c2c;
    color: #eee;
    border: 1px solid #555;
    border-radius: 6px;
    padding: 4px 8px;
    cursor: pointer;
    font-size: 12px;
    white-space: nowrap;
  }
  button.action:hover {
    background: #3a3a3a;
  }
  label.toggle {
    display: flex;
    align-items: center;
    gap: 6px;
    cursor: pointer;
    user-select: none;
  }
  label.toggle input {
    flex: 0 0 auto;
    width: auto;
  }
  #status {
    margin-top: 8px;
    display: flex;
    gap: 6px;
    align-items: center;
    min-height: 18px;
    color: #cfcfcf;
  }
  #panel.is-success #status {
    color: #b9f6ca;
  }
  #panel.is-error #status {
    color: #ffb4b4;
  }
  #spinner {
    width: 12px;
    height: 12px;
    border: 2px solid rgba(255,255,255,0.25);
    border-top-color: #fff;
    border-radius: 50%;
    display: none;
    animation: spin 0.8s linear infinite;
  }
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
  #open-btn {
    position: fixed;
    top: 8px;
    right: 8px;
    z-index: 9998;
    background: #2c2c2c;
    color: #eee;
    border: 1px solid #555;
    border-radius: 18px;
    padding: 6px 12px;
    cursor: pointer;
    font-size: 12px;
  }
</style>
<div id="overlay">
  <div id="panel">
    <div id="header">
      <div id="title">Download Audio</div>
      <div id="controls">
        <button id="minimize-btn" type="button" aria-label="Minimize">_</button>
      </div>
    </div>
    <div class="row">
      <input id="url-input" type="url" placeholder="Paste YouTube URL..." autocomplete="off" spellcheck="false" />
      <button id="download-btn" class="action" type="button">Download</button>
      <button id="stop-btn" class="action" type="button">Stop</button>
    </div>
    <div class="row">
      <label class="toggle">
        <input id="playlist-toggle" type="checkbox" />
        Download playlist
      </label>
    </div>
    <div class="row">
      <input id="root-input" type="text" placeholder="Download/Export folder path" autocomplete="off" spellcheck="false" />
      <button id="root-browse" class="action" type="button">Browse</button>
      <button id="root-save" class="action" type="button">Set</button>
    </div>
    <div id="status">
      <span id="spinner"></span>
      <span id="status-text"></span>
    </div>
  </div>
</div>
<button id="open-btn" type="button">Download</button>
`;
    }

    _wire() {
      const {
        openBtn,
        minimizeBtn,
        downloadBtn,
        rootSave,
        rootBrowse
      } = this._elements;

      if (openBtn) {
        openBtn.addEventListener('click', () => this.show());
      }
      if (minimizeBtn) {
        minimizeBtn.addEventListener('click', () => this.hide());
      }
      if (downloadBtn) {
        downloadBtn.addEventListener('click', () => this._download());
      }
      if (this._elements.stopBtn) {
        this._elements.stopBtn.addEventListener('click', () => this._stopDownload());
      }
      if (this._elements.playlistToggle) {
        this._elements.playlistToggle.addEventListener('change', () => {
          if (window.localStorage) {
            window.localStorage.setItem(
              'aw_download_playlist',
              this._elements.playlistToggle.checked ? '1' : '0'
            );
          }
        });
      }
      if (rootSave) {
        rootSave.addEventListener('click', () => this._saveRoot());
      }
      if (rootBrowse) {
        rootBrowse.addEventListener('click', () => this._browseRoot());
      }
    }

    _getTauri() {
      const tauri = window.__TAURI__;
      const invoke = tauri && ((tauri.core && tauri.core.invoke) || tauri.invoke);
      const shell = tauri && (tauri.shell || (tauri.plugin && tauri.plugin.shell));
      const dialog = tauri && (tauri.dialog || (tauri.plugin && tauri.plugin.dialog));
      const Command = shell && shell.Command;
      return { tauri, invoke, dialog, Command };
    }
    _ytDlpCandidates(binariesDir) {
      return [
        `${binariesDir}\\yt-dlp-x86_64-pc-windows-msvc.exe`,
        `${binariesDir}\\yt-dlp.exe`
      ];
    }

    async _initRoot() {
      const { invoke } = this._getTauri();
      if (!invoke) {
        this.setStatus('error', 'Tauri unavailable');
        return;
      }
      try {
        const root = await invoke('get_download_root');
        if (this._elements.rootInput) this._elements.rootInput.value = root;
        if (this._elements.playlistToggle && window.localStorage) {
          this._elements.playlistToggle.checked = window.localStorage.getItem('aw_download_playlist') === '1';
        }
        if (this._elements.stopBtn) this._elements.stopBtn.disabled = true;
      } catch (_) {
        this.setStatus('error', 'Download failed. See logs.');
      }
    }

    async _saveRoot() {
      const { invoke } = this._getTauri();
      if (!invoke || !this._elements.rootInput) return;
      const value = this._elements.rootInput.value.trim();
      try {
        const updated = await invoke('set_download_root', { path: value });
        this._elements.rootInput.value = updated;
        this.setStatus('success', 'Download folder set.');
      } catch (_) {
        this.setStatus('error');
      }
    }

    async _browseRoot() {
      const { dialog } = this._getTauri();
      if (!dialog || !dialog.open || !this._elements.rootInput) {
        this.setStatus('error', 'Folder picker unavailable.');
        return;
      }
      try {
        const result = await dialog.open({ directory: true, multiple: false });
        if (typeof result === 'string') {
          this._elements.rootInput.value = result;
          await this._saveRoot();
        }
      } catch (_) {
        this.setStatus('error', 'Folder picker failed.');
      }
    }

    _formatDateFolder() {
      const now = new Date();
      const yyyy = String(now.getFullYear());
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const dd = String(now.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    }

    _formatLogStamp() {
      const now = new Date();
      const yyyy = String(now.getFullYear());
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const dd = String(now.getDate()).padStart(2, '0');
      const hh = String(now.getHours()).padStart(2, '0');
      const mi = String(now.getMinutes()).padStart(2, '0');
      const ss = String(now.getSeconds()).padStart(2, '0');
      return `${yyyy}${mm}${dd}_${hh}${mi}${ss}`;
    }

    _formatSize(bytes) {
      if (!bytes || !bytes.length) return '';
      const sizeMb = bytes.length / (1024 * 1024);
      return ` (${sizeMb.toFixed(1)} MB)`;
    }

    _looksLikeUrl(value) {
      return /^https?:\/\/.+/i.test(value || '');
    }

    async _download() {
      const { invoke, Command } = this._getTauri();
      const url = this._elements.urlInput ? this._elements.urlInput.value.trim() : '';
      if (!this._looksLikeUrl(url)) {
        this.setStatus('error');
        return;
      }
      if (!invoke || !Command) {
        this.setStatus('error');
        return;
      }

      if (this._isDownloading) return;
      this._isDownloading = true;
      if (this._elements.downloadBtn) this._elements.downloadBtn.disabled = true;
      if (this._elements.stopBtn) this._elements.stopBtn.disabled = false;
      this.setStatus('downloading');

      const dateFolder = this._formatDateFolder();
      const logStamp = this._formatLogStamp();
      let downloadDir = '';
      let logPath = '';
      const logLines = [];
      let spawnError = '';
      let downloadPath = '';
      let binariesDir = '';
      let chosenYtDlpPath = '';
      let cancelRequested = false;
      const suppressWarnings = window.localStorage
        && window.localStorage.getItem('aw_ytdlp_no_warnings') === '1';
      const allowPlaylist = window.localStorage
        && window.localStorage.getItem('aw_download_playlist') === '1';

      try {
        const prep = await invoke('prepare_download', { dateFolder, logStamp });
        downloadDir = prep && prep.download_dir ? prep.download_dir : '';
        logPath = prep && prep.log_path ? prep.log_path : '';

        binariesDir = await invoke('get_binaries_dir');
        logLines.push(`[diag] binariesDir=${binariesDir}`);
        const outputTemplate = `${downloadDir}\\%(uploader)s__%(title)s__%(id)s.%(ext)s`;
        const jsRuntime = window.localStorage
          && window.localStorage.getItem('aw_ytdlp_js_runtime');
        const jsRuntimeValue = jsRuntime && jsRuntime.trim() ? jsRuntime.trim() : 'node';
        const args = [
          '--ignore-config',
          '--js-runtimes', jsRuntimeValue,
          '--no-progress',
          '--newline',
          '--encoding', 'utf-8',
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
        if (!allowPlaylist) {
          args.splice(1, 0, '--no-playlist');
        } else {
          args.splice(1, 0, '--yes-playlist');
        }

        let command = null;
        logLines.push('[diag] using Command.sidecar name=binaries/yt-dlp');
        command = Command.sidecar('binaries/yt-dlp', args);
        chosenYtDlpPath = 'sidecar:binaries/yt-dlp';

        const safeToString = (chunk, label) => {
          try {
            return chunk.toString();
          } catch (err) {
            logLines.push(`[diag] ${label}_decode_error=${String(err || '')}`);
            return String(chunk || '');
          }
        };

        command.stdout.on('data', (line) => {
          const text = safeToString(line, 'stdout');
          if (text) logLines.push(text);
          const trimmed = (text || '').trim();
          if (trimmed && downloadDir && trimmed.toLowerCase().startsWith(downloadDir.toLowerCase())) {
            downloadPath = trimmed;
          }
        });

        command.stderr.on('data', (line) => {
          const text = safeToString(line, 'stderr');
          if (text) {
            logLines.push(text);
          }
        });

        command.on('error', (error) => {
          spawnError = error && error.toString ? error.toString() : String(error || '');
          logLines.push(`[diag] command.on_error path=${chosenYtDlpPath} err=${spawnError}`);
        });

        command.on('close', async (event) => {
          const code = event && typeof event.code === 'number' ? event.code : 1;
          logLines.push(`[diag] command.on_close code=${code} path=${chosenYtDlpPath}`);
          if (cancelRequested) {
            logLines.push('[diag] cancel_complete=true');
          }
          let resolvedPath = downloadPath;
          if (!cancelRequested && code === 0 && (!resolvedPath || !resolvedPath.toLowerCase().endsWith('.m4a'))) {
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
          const lowerLog = logText.toLowerCase();
          const is403 = lowerLog.includes('http error 403')
            || lowerLog.includes('unable to download video data');

          if (!cancelRequested && code === 0 && isM4a) {
            try {
              // Persist the resolved download path for user visibility/support.
              if (resolvedPath) {
                try {
                  const metaPath = `${downloadDir}\\last_download.txt`;
                  await invoke('write_meta_file', {
                    path: metaPath,
                    contents: resolvedPath
                  });
                  logLines.push(`[diag] last_download_meta=${metaPath}`);
                } catch (metaErr) {
                  logLines.push(`[diag] last_download_meta_error=${String(metaErr || '')}`);
                }
              }
              const bytes = await invoke('read_downloaded_file', { path: resolvedPath });
              if (!bytes || !bytes.length) {
                throw new Error('Downloaded file is empty');
              }
              const blob = new Blob([new Uint8Array(bytes)], { type: 'audio/mp4' });
              if (window.PKAudioEditor && window.PKAudioEditor.engine) {
                window.PKAudioEditor.engine.LoadArrayBuffer(blob);
              }
              const shortPath = resolvedPath
                ? resolvedPath.split('\\').slice(-2).join('\\')
                : 'File imported';
              const sizeText = this._formatSize(bytes);
              this.setStatus('success', `Ready: ${shortPath}${sizeText}`);
            } catch (_) {
              this.setStatus('error', 'Download finished but file could not be loaded.');
            }
          } else {
            if (cancelRequested) {
              this.setStatus('error', 'Download stopped.');
            } else if (is403) {
              this.setStatus(
                'error',
                'YouTube blocked the download (HTTP 403). Update yt-dlp, try a different network, or disable VPN.'
              );
            } else if (code === 0) {
              this.setStatus('error', 'Download finished but output file is missing.');
            } else {
              this.setStatus('error');
            }
          }

          this._isDownloading = false;
          if (this._elements.downloadBtn) this._elements.downloadBtn.disabled = false;
          if (this._elements.stopBtn) this._elements.stopBtn.disabled = true;
          this._currentChild = null;
          this._cancelDownload = null;
        });

        this._cancelDownload = async () => {
          if (!this._isDownloading) return;
          cancelRequested = true;
          logLines.push('[diag] cancel_requested=true');
          if (this._currentChild && this._currentChild.kill) {
            try {
              await this._currentChild.kill();
            } catch (err) {
              logLines.push(`[diag] cancel_kill_error=${String(err || '')}`);
            }
          }
          this.setStatus('error', 'Download stopped.');
        };

        this._currentChild = await command.spawn();
        logLines.push(`[diag] spawn_called path=${chosenYtDlpPath}`);
      } catch (error) {
        if (logPath) {
          try {
            const errText = String(error || '');
            const diagText = logLines.length ? `\n${logLines.join('\n')}` : '';
            await invoke('write_download_log', { path: logPath, contents: `${errText}${diagText}` });
          } catch (_) {}
        }
        this.setStatus('error');
        this._isDownloading = false;
        if (this._elements.downloadBtn) this._elements.downloadBtn.disabled = false;
        if (this._elements.stopBtn) this._elements.stopBtn.disabled = true;
        this._currentChild = null;
        this._cancelDownload = null;
      }
    }

    async _stopDownload() {
      if (this._cancelDownload) {
        await this._cancelDownload();
      }
    }
  }

  if (!customElements.get('download-panel')) {
    customElements.define('download-panel', DownloadPanel);
  }

  const panelEl = document.createElement('download-panel');
  container.appendChild(panelEl);

  window.DownloadUI = {
    show: () => panelEl.show(),
    hide: () => panelEl.hide(),
    setStatus: (state, message) => panelEl.setStatus(state, message)
  };
})();
