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
        urlInput: this._shadow.getElementById('url-input'),
        rootInput: this._shadow.getElementById('root-input'),
        rootSave: this._shadow.getElementById('root-save'),
        rootBrowse: this._shadow.getElementById('root-browse'),
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
    padding: 4px 10px;
    cursor: pointer;
    font-size: 12px;
  }
  button.action:hover {
    background: #3a3a3a;
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

    async _initRoot() {
      const { invoke } = this._getTauri();
      if (!invoke) {
        this.setStatus('error', 'Tauri unavailable');
        return;
      }
      try {
        const root = await invoke('get_download_root');
        if (this._elements.rootInput) this._elements.rootInput.value = root;
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
      this.setStatus('downloading');

      const dateFolder = this._formatDateFolder();
      const logStamp = this._formatLogStamp();
      let downloadDir = '';
      let logPath = '';
      const logLines = [];
      let spawnError = '';
      let downloadPath = '';

      try {
        downloadDir = await invoke('ensure_downloads_dir', { dateFolder });
        logPath = `${downloadDir}\\download_${logStamp}.log`;

        const binariesDir = await invoke('get_binaries_dir');
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

        const command = Command.sidecar('binaries/yt-dlp', args);

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
        });

        command.on('close', async (event) => {
          const code = event && typeof event.code === 'number' ? event.code : 1;
          const logText = logLines.join('\n') + (spawnError ? `\n${spawnError}` : '');

          if (logPath) {
            try {
              await invoke('write_download_log', { path: logPath, contents: logText });
            } catch (_) {}
          }

          const isM4a = downloadPath && downloadPath.toLowerCase().endsWith('.m4a');

          if (code === 0 && isM4a) {
            try {
              const bytes = await invoke('read_downloaded_file', { path: downloadPath });
              const blob = new Blob([new Uint8Array(bytes)], { type: 'audio/mp4' });
              if (window.PKAudioEditor && window.PKAudioEditor.engine) {
                window.PKAudioEditor.engine.LoadArrayBuffer(blob);
              }
              this.setStatus('success');
            } catch (_) {
              this.setStatus('error');
            }
          } else {
            this.setStatus('error');
          }

          this._isDownloading = false;
          if (this._elements.downloadBtn) this._elements.downloadBtn.disabled = false;
        });

        await command.spawn();
      } catch (error) {
        if (logPath) {
          try {
            await invoke('write_download_log', { path: logPath, contents: String(error || '') });
          } catch (_) {}
        }
        this.setStatus('error');
        this._isDownloading = false;
        if (this._elements.downloadBtn) this._elements.downloadBtn.disabled = false;
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
