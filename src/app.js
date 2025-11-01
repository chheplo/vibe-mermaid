import { initMermaid, renderDiagram, getSvgString, setTheme, getMindmapRenderer } from './mermaid.js';
import { OpenAIProvider, buildPrompt, ensureJsonObject } from './provider.js';
import { initSpeech } from './speech.js';

// Persistent state
const state = {
  settings: /** @type {{provider:string, apiBase:string, apiKey:string, model:string}} */ (null),
  provider: /** @type {null | OpenAIProvider} */ (null),
  diagram: 'flowchart TD\n  A[Start] --> B{Is it beautiful?}\n  B -- Yes --> C[Ship it] \n  B -- No --> D[Polish UI]\n  D --> B',
  messages: /** @type {{role:'user'|'assistant', content:string}[]} */ ([]),
  diagramName: 'diagram',
};

const els = {
  chatLog: document.getElementById('chat-log'),
  chatText: document.getElementById('chat-text'),
  chatStatus: document.getElementById('chat-status'),
  btnSend: document.getElementById('btn-send'),
  btnMic: document.getElementById('btn-mic'),
  btnNew: document.getElementById('btn-new'),
  newMenu: document.getElementById('new-menu'),
  btnExport: document.getElementById('btn-export'),
  exportMenu: document.getElementById('export-menu'),
  code: document.getElementById('code-editor'),
  btnApply: document.getElementById('btn-apply'),
  preview: document.getElementById('preview-container'),
  zoomIn: document.getElementById('zoom-in'),
  zoomOut: document.getElementById('zoom-out'),
  zoomReset: document.getElementById('zoom-reset'),
  tabs: Array.from(document.querySelectorAll('.tab')),
  tabPreview: document.getElementById('tab-preview'),
  tabCode: document.getElementById('tab-code'),
  btnTheme: document.getElementById('btn-theme'),
  themeMenu: document.getElementById('theme-menu'),
  btnUiTheme: document.getElementById('btn-ui-theme'),
  nameField: document.getElementById('diagram-name'),
  btnSettings: document.getElementById('btn-settings'),
  modal: document.getElementById('settings-modal'),
  fieldProvider: document.getElementById('provider'),
  fieldApiBase: document.getElementById('api-base'),
  fieldApiKey: document.getElementById('api-key'),
  fieldModel: document.getElementById('model'),
  btnSaveSettings: document.getElementById('btn-save-settings'),
  btnToggleChat: document.getElementById('btn-toggle-chat'),
  chatPane: document.getElementById('chat-pane'),
  layout: document.querySelector('.layout'),
};

function saveSettings(s){ localStorage.setItem('mermaid_copilot_settings', JSON.stringify(s)); }
function loadSettings(){
  try { return JSON.parse(localStorage.getItem('mermaid_copilot_settings')||'null'); }
  catch { return null; }
}
function saveTheme(theme){ localStorage.setItem('mermaid_copilot_theme', theme); }
function loadTheme(){ return localStorage.getItem('mermaid_copilot_theme') || 'dark'; }
function saveUiTheme(t){ localStorage.setItem('mermaid_copilot_ui_theme', t); }
function loadUiTheme(){ return localStorage.getItem('mermaid_copilot_ui_theme') || 'dark'; }
function saveName(name){ localStorage.setItem('mermaid_copilot_name', name || 'diagram'); }
function loadName(){ return localStorage.getItem('mermaid_copilot_name') || 'diagram'; }
function sanitizeFilename(s){
  const base = (s || 'diagram').toString().trim().toLowerCase();
  const slug = base.replace(/[^a-z0-9-_\.\s]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').replace(/^[-_.]+|[-_.]+$/g, '');
  return slug || 'diagram';
}
function hydrateSettings(){
  const s = loadSettings();
  if (s){
    els.fieldProvider.value = s.provider || 'openai';
    els.fieldApiBase.value = s.apiBase || 'https://api.openai.com/v1';
    els.fieldApiKey.value = s.apiKey || '';
    els.fieldModel.value = s.model || 'gpt-4o-mini';
  } else {
    els.fieldProvider.value = 'openai';
    els.fieldApiBase.value = 'https://api.openai.com/v1';
    els.fieldModel.value = 'gpt-4o-mini';
  }
}

function applySettings(){
  const s = {
    provider: els.fieldProvider.value,
    apiBase: els.fieldApiBase.value.trim(),
    apiKey: els.fieldApiKey.value.trim(),
    model: els.fieldModel.value.trim(),
  };
  state.settings = s;
  saveSettings(s);
  state.provider = new OpenAIProvider(s.apiBase, s.apiKey);
  updateChatStatus();
}

function updateChatStatus(){
  const okay = !!(state?.settings?.apiKey && state?.settings?.model && state?.provider);
  els.chatStatus.textContent = okay ? 'Ready' : 'Add API key and model in Settings to start';
  els.btnSend.disabled = !okay;
  els.btnMic.disabled = !okay;
}

function addMessage(role, content){
  state.messages.push({role, content});
  const row = document.createElement('div');
  row.className = `msg ${role}`;
  const roleEl = document.createElement('div');
  roleEl.className = 'role';
  roleEl.textContent = role === 'user' ? '🧑' : '🤖';
  const bubble = document.createElement('div');
  bubble.className = 'bubble';
  bubble.innerText = content;
  row.append(roleEl, bubble);
  els.chatLog.appendChild(row);
  els.chatLog.scrollTop = els.chatLog.scrollHeight;
}

async function handleSend(){
  const text = els.chatText.value.trim();
  if (!text) return;
  els.chatText.value = '';
  addMessage('user', text);

  const messages = [
    { role: 'system', content: buildPrompt(state.diagram) },
    ...state.messages,
  ];

  // Add loading message with animated dots
  const loadingRow = document.createElement('div');
  loadingRow.className = 'msg assistant loading';
  const roleEl = document.createElement('div');
  roleEl.className = 'role';
  roleEl.textContent = '🤖';
  const bubble = document.createElement('div');
  bubble.className = 'bubble loading-bubble';
  bubble.innerHTML = '<div class="loading-spinner"></div><span class="loading-text">Thinking...</span>';
  loadingRow.append(roleEl, bubble);
  els.chatLog.appendChild(loadingRow);
  els.chatLog.scrollTop = els.chatLog.scrollHeight;

  // Disable send button during processing
  els.btnSend.disabled = true;
  els.chatText.disabled = true;

  try {
    const resp = await state.provider.chat(state.settings.model, messages);
    const content = ensureJsonObject(resp);
    let explanation = content.explanation || 'Updated the diagram.';
    let diagram = content.diagram || content.mermaid || content.code || '';

    if (!diagram){
      // try to extract fenced mermaid block
      const match = /```mermaid\n([\s\S]*?)```/m.exec(resp);
      if (match) diagram = match[1];
    }
    if (!diagram){
      explanation = (resp || '').slice(0, 600);
      diagram = state.diagram; // no change
    }
    state.diagram = diagram;
    els.code.value = diagram;
    await renderDiagram(diagram, els.preview);
    ensureZoomContent();
    applyZoomTransform();

    // Remove loading message and add actual response
    loadingRow.remove();
    addMessage('assistant', explanation);

  } catch (err){
    console.error(err);
    // Remove loading message and show error
    loadingRow.remove();
    addMessage('assistant', 'Error: ' + (err.message || err));
  } finally {
    // Re-enable inputs
    els.btnSend.disabled = false;
    els.chatText.disabled = false;
    els.chatText.focus();
  }
}

function initTabs(){
  els.tabs.forEach(t => t.addEventListener('click', () => {
    els.tabs.forEach(x => x.classList.remove('active'));
    t.classList.add('active');
    const tab = t.getAttribute('data-tab');
    els.tabPreview.classList.toggle('hidden', tab !== 'preview');
    els.tabCode.classList.toggle('hidden', tab !== 'code');
  }));
}

function initExport(){
  const wrapper = els.btnExport.parentElement; // .menu
  let hideTimer = null;

  const showMenu = () => {
    if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
    els.exportMenu.removeAttribute('hidden');
  };
  const hideMenu = (immediate=false) => {
    if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
    if (immediate) { els.exportMenu.setAttribute('hidden',''); return; }
    hideTimer = setTimeout(() => els.exportMenu.setAttribute('hidden',''), 160);
  };

  // Hover to open, leave to close
  wrapper.addEventListener('mouseenter', showMenu);
  wrapper.addEventListener('mouseleave', () => hideMenu(false));

  // Click toggles state (also closes when open)
  els.btnExport.addEventListener('click', (e) => {
    const hidden = els.exportMenu.hasAttribute('hidden');
    if (hidden) showMenu(); else hideMenu(true);
  });

  // Click outside closes
  document.addEventListener('click', (e) => {
    if (wrapper.contains(e.target)) return;
    hideMenu(true);
  });

  // Escape closes
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') hideMenu(true);
  });
  els.exportMenu.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const action = btn.getAttribute('data-action');
    const base = sanitizeFilename(state.diagramName);
    if (action === 'save-mmd'){
      downloadText(els.code.value || state.diagram, base + '.mmd');
    } else if (action === 'export-svg'){
      const svg = await getSvgString();
      downloadText(svg, base + '.svg', 'image/svg+xml');
    } else if (action === 'export-png'){
      const svg = await getSvgString();
      const url = await svgToPng(svg, 2);
      downloadUrl(url, base + '.png');
      URL.revokeObjectURL(url);
    }
    hideMenu(true);
  });
}

function initThemeDropdown(){
  const wrapper = els.btnTheme?.parentElement; // .menu
  if (!wrapper || !els.themeMenu) return;
  let hideTimer = null;
  const showMenu = () => { if (hideTimer){ clearTimeout(hideTimer); hideTimer=null;} els.themeMenu.removeAttribute('hidden'); };
  const hideMenu = (immediate=false) => { if (hideTimer){ clearTimeout(hideTimer); hideTimer=null;} if (immediate){ els.themeMenu.setAttribute('hidden',''); return;} hideTimer=setTimeout(()=>els.themeMenu.setAttribute('hidden',''),160); };
  wrapper.addEventListener('mouseenter', showMenu);
  wrapper.addEventListener('mouseleave', () => hideMenu(false));
  els.btnTheme.addEventListener('click', () => { const hidden = els.themeMenu.hasAttribute('hidden'); if (hidden) showMenu(); else hideMenu(true); });
  document.addEventListener('click', (e) => { if (wrapper.contains(e.target)) return; hideMenu(true); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') hideMenu(true); });

  els.themeMenu.addEventListener('click', async (e) => {
    const item = e.target.closest('[data-theme]');
    if (!item) return;
    const key = item.getAttribute('data-theme');
    saveTheme(key);
    const p = getMermaidPreset(key);
    setTheme(p.theme, p.themeVariables);
    await renderDiagram(state.diagram, els.preview);
    ensureZoomContent();
    applyZoomTransform();
    els.btnTheme.textContent = `Theme: ${labelForTheme(key)}`;
    hideMenu(true);
  });
}

function downloadText(text, filename, type='text/plain'){
  const blob = new Blob([text], {type});
  const url = URL.createObjectURL(blob);
  downloadUrl(url, filename);
  URL.revokeObjectURL(url);
}
function downloadUrl(url, filename){
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
}
async function svgToPng(svgString, scale=2){
  // Determine dimensions from width/height or viewBox
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgString, 'image/svg+xml');
  const svgEl = doc.documentElement;
  let w = parseFloat(svgEl.getAttribute('width')) || 0;
  let h = parseFloat(svgEl.getAttribute('height')) || 0;
  const vb = svgEl.getAttribute('viewBox');
  if ((!w || !h) && vb){
    const [, , vbw, vbh] = vb.split(/\s+/).map(Number);
    w = w || vbw || 800;
    h = h || vbh || 600;
  }
  if (!w || !h){ w = 800; h = 600; }
  w = Math.round(w * scale); h = Math.round(h * scale);

  // Inline width/height to ensure raster size
  svgEl.setAttribute('width', String(w));
  svgEl.setAttribute('height', String(h));
  const serialized = new XMLSerializer().serializeToString(svgEl);

  const img = new Image();
  const loaded = new Promise((res, rej) => { img.onload = res; img.onerror = rej; });
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(serialized);
  await loaded;
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff00'; ctx.fillRect(0,0,w,h);
  ctx.drawImage(img, 0, 0, w, h);
  const pngUrl = canvas.toDataURL('image/png');
  return pngUrl;
}

function initSettings(){
  hydrateSettings();
  const s = loadSettings();
  if (s){ state.settings = s; state.provider = new OpenAIProvider(s.apiBase, s.apiKey); }
  updateChatStatus();
  els.btnSettings.addEventListener('click', () => { els.modal.showModal(); document.body.classList.add('no-scroll'); });
  els.btnSaveSettings.addEventListener('click', (e) => { e.preventDefault(); applySettings(); els.modal.close(); });
  els.modal.addEventListener('close', () => { document.body.classList.remove('no-scroll'); });
}

// Template definitions
const templates = {
  empty: {
    diagram: '',
    name: 'diagram'
  },
  diagram: {
    diagram: 'flowchart TD\n  A[Start] --> B{Is it beautiful?}\n  B -- Yes --> C[Ship it] \n  B -- No --> D[Polish UI]\n  D --> B',
    name: 'flowchart'
  },
  mindmap: {
    diagram: `mindmap
  root((Copilot Chat))
    (Personal CRM)
      CRM Canvas Framework
      Outreach Strategy
      Pat Follow-up
      Health Canvas
    (Fundraise 2025)
      Fundraise Canvas
      Investors & Backers
      Board Structure
    (Health)
      Training Plan
      Nutrition Plan
      Places to Visit
      Packing Lists
    (Templates)
      Canvas Templates
      Home Canvas
      Product Dev
      GTM Frameworks
    (Boards)
      Tools Board
      Items Board
      Startup Board
    (Knowledge)
      GTM Board
      Research Board
      Hiring Board
    (Finance Ops)
      Finance Board
      Job Descriptions
      Ad Channels
    (Product Dev)
      Add Tools
      Delete Items
      Dev Frameworks
      Engineering Link
    (Engineering)
      Tasks Board
      Design Tools
      Launch Checklist
      AI Tools`,
    name: 'mindmap'
  }
};

function loadTemplate(templateKey) {
  const template = templates[templateKey] || templates.empty;
  state.messages = [];
  state.diagram = template.diagram;
  state.diagramName = template.name;
  saveName(state.diagramName);
  els.chatLog.innerHTML = '';
  els.code.value = state.diagram;
  if (els.nameField) els.nameField.value = state.diagramName;
  if (typeof resetZoom === 'function') resetZoom();
  renderDiagram(state.diagram, els.preview);
}

function initNewSession(){
  const wrapper = els.btnNew?.parentElement; // .menu
  if (!wrapper || !els.newMenu) return;
  
  let hideTimer = null;
  const showMenu = () => { 
    if (hideTimer){ clearTimeout(hideTimer); hideTimer=null;} 
    els.newMenu.removeAttribute('hidden'); 
  };
  const hideMenu = (immediate=false) => { 
    if (hideTimer){ clearTimeout(hideTimer); hideTimer=null;} 
    if (immediate){ 
      els.newMenu.setAttribute('hidden',''); 
      return;
    } 
    hideTimer=setTimeout(()=>els.newMenu.setAttribute('hidden',''),160); 
  };
  
  // Hover to open, leave to close
  wrapper.addEventListener('mouseenter', showMenu);
  wrapper.addEventListener('mouseleave', () => hideMenu(false));
  
  // Click toggles state
  els.btnNew.addEventListener('click', () => { 
    const hidden = els.newMenu.hasAttribute('hidden'); 
    if (hidden) showMenu(); 
    else hideMenu(true); 
  });
  
  // Click outside closes
  document.addEventListener('click', (e) => { 
    if (wrapper.contains(e.target)) return; 
    hideMenu(true); 
  });
  
  // Escape closes
  document.addEventListener('keydown', (e) => { 
    if (e.key === 'Escape') hideMenu(true); 
  });
  
  // Handle template selection
  els.newMenu.addEventListener('click', (e) => {
    const item = e.target.closest('[data-template]');
    if (!item) return;
    const templateKey = item.getAttribute('data-template');
    if (!confirm(`Start a new session with ${templateKey === 'empty' ? 'an empty canvas' : templateKey + ' template'}? This clears chat and current diagram.`)) return;
    loadTemplate(templateKey);
    hideMenu(true);
  });
}

function initCode(){
  els.code.value = state.diagram;
  els.btnApply.addEventListener('click', async () => {
    state.diagram = els.code.value;
    await renderDiagram(state.diagram, els.preview);
    ensureZoomContent();
    applyZoomTransform();
  });
}

function initMobileMenu(){
  const burger = document.getElementById('btn-burger');
  const headerActions = document.getElementById('header-actions');
  const overlay = document.getElementById('mobile-overlay');
  
  if (!burger || !headerActions || !overlay) return;
  
  const toggleMenu = () => {
    const isOpen = headerActions.classList.contains('show');
    if (isOpen) {
      headerActions.classList.remove('show');
      overlay.classList.remove('show');
    } else {
      headerActions.classList.add('show');
      overlay.classList.add('show');
    }
  };
  
  burger.addEventListener('click', toggleMenu);
  overlay.addEventListener('click', toggleMenu);
  
  // Close menu when clicking any button inside
  headerActions.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', () => {
      // Small delay to let the action complete
      setTimeout(() => {
        headerActions.classList.remove('show');
        overlay.classList.remove('show');
      }, 100);
    });
  });
}

function saveChatToggle(collapsed){ localStorage.setItem('mermaid_copilot_chat_collapsed', collapsed ? 'true' : 'false'); }
function loadChatToggle(){ return localStorage.getItem('mermaid_copilot_chat_collapsed') === 'true'; }

function initChatToggle(){
  if (!els.btnToggleChat || !els.chatPane || !els.layout) return;
  
  const updateToggleButton = (collapsed) => {
    if (collapsed) {
      els.btnToggleChat.setAttribute('title', 'Expand chat sidebar');
    } else {
      els.btnToggleChat.setAttribute('title', 'Collapse chat sidebar');
    }
  };
  
  // Load saved state
  const isCollapsed = loadChatToggle();
  if (isCollapsed) {
    els.chatPane.classList.add('collapsed');
    els.layout.classList.add('chat-collapsed');
    updateToggleButton(true);
  }
  
  // Toggle handler
  els.btnToggleChat.addEventListener('click', () => {
    const collapsed = els.chatPane.classList.toggle('collapsed');
    els.layout.classList.toggle('chat-collapsed');
    saveChatToggle(collapsed);
    updateToggleButton(collapsed);
  });
}

async function main(){
  initTabs();
  initExport();
  initThemeDropdown();
  initSettings();
  initNewSession();
  initCode();
  initMobileMenu();
  initChatToggle();
  initSpeech(els.btnMic, els.chatText);
  await initMermaid();
  // UI Theme
  const ui = loadUiTheme();
  applyUiTheme(ui);
  if (els.btnUiTheme){ updateUiThemeIcon(ui); els.btnUiTheme.addEventListener('click', () => {
    const next = (loadUiTheme() === 'dark') ? 'light' : 'dark';
    applyUiTheme(next); updateUiThemeIcon(next); saveUiTheme(next);
  }); }

  // Mermaid Theme
  const themeKey = loadTheme();
  const preset = getMermaidPreset(themeKey);
  setTheme(preset.theme, preset.themeVariables);
  if (els.btnTheme){ els.btnTheme.textContent = `Theme: ${labelForTheme(themeKey)}`; }
  // Name
  state.diagramName = loadName();
  if (els.nameField){ els.nameField.value = state.diagramName; }
  await renderDiagram(state.diagram, els.preview);
  initZoom();
  ensureZoomContent();
  applyZoomTransform();
  updateChatStatus();
  els.btnSend.addEventListener('click', handleSend);
  els.chatText.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSend();
  });
  // Auto-size chat textarea
  const autosize = (el) => { if (!el) return; el.style.height = 'auto'; const limit = Math.floor(window.innerHeight * 0.5); el.style.height = Math.min(el.scrollHeight, limit) + 'px'; };
  autosize(els.chatText);
  els.chatText.addEventListener('input', () => autosize(els.chatText));

  if (els.nameField){
    els.nameField.addEventListener('input', () => {
      state.diagramName = els.nameField.value;
      saveName(state.diagramName);
    });
  }
}

function applyUiTheme(t){
  document.documentElement.setAttribute('data-ui-theme', t);
}
function updateUiThemeIcon(t){
  if (!els.btnUiTheme) return;
  els.btnUiTheme.textContent = (t === 'light') ? '🌞' : '🌙';
}

function getMermaidPreset(key){
  // Built-ins
  if (['default','dark','forest','neutral'].includes(key)) return { theme: key };
  // Custom palettes (12+)
  const presets = {
    slate: { theme: 'dark', themeVariables: { primaryColor: '#334155', primaryTextColor: '#e2e8f0', lineColor: '#64748b', secondaryColor: '#1f2937', tertiaryColor: '#0f172a', edgeLabelBackground: '#1f2937' }},
    ocean: { theme: 'dark', themeVariables: { primaryColor: '#0ea5e9', primaryTextColor: '#e0f2fe', lineColor: '#38bdf8', secondaryColor: '#083344', tertiaryColor: '#082f49', edgeLabelBackground: '#082f49' }},
    emerald: { theme: 'default', themeVariables: { primaryColor: '#10b981', primaryTextColor: '#052e2b', lineColor: '#34d399', secondaryColor: '#064e3b', tertiaryColor: '#022c22', noteBkgColor: '#ecfdf5', edgeLabelBackground: '#064e3b' }},
    sunset: { theme: 'default', themeVariables: { primaryColor: '#fb923c', primaryTextColor: '#3b0b0b', lineColor: '#fdba74', secondaryColor: '#7c2d12', tertiaryColor: '#451a03', noteBkgColor: '#fff7ed', edgeLabelBackground: '#7c2d12' }},
    rose: { theme: 'default', themeVariables: { primaryColor: '#f43f5e', primaryTextColor: '#fff1f2', lineColor: '#fb7185', secondaryColor: '#881337', tertiaryColor: '#4c0519', noteBkgColor: '#fff1f2', edgeLabelBackground: '#4c0519' }},
    cyberpunk: { theme: 'dark', themeVariables: { primaryColor: '#22d3ee', primaryTextColor: '#041b23', lineColor: '#a78bfa', secondaryColor: '#7c5cff', tertiaryColor: '#0ea5e9', background: '#0b0f1a', edgeLabelBackground: '#0b0f1a' }},
    grayscale: { theme: 'neutral', themeVariables: { primaryColor: '#9ca3af', primaryTextColor: '#111827', lineColor: '#6b7280', secondaryColor: '#4b5563', tertiaryColor: '#374151', noteBkgColor: '#f3f4f6' }},
    highcontrast: { theme: 'neutral', themeVariables: { primaryColor: '#000000', primaryTextColor: '#ffffff', lineColor: '#000000', secondaryColor: '#ffff00', tertiaryColor: '#ffffff', background: '#ffffff', edgeLabelBackground: '#ffff00' }},
    pastel: { theme: 'default', themeVariables: { primaryColor: '#c7d2fe', primaryTextColor: '#1f2937', lineColor: '#fbcfe8', secondaryColor: '#bae6fd', tertiaryColor: '#fecaca', noteBkgColor: '#f8fafc' }},
    halloween: { theme: 'dark', themeVariables: { primaryColor: '#f59e0b', primaryTextColor: '#1f1300', lineColor: '#f97316', secondaryColor: '#0f172a', tertiaryColor: '#111827', noteBkgColor: '#1f2937', edgeLabelBackground: '#111827' }},
  };
  return presets[key] || { theme: 'dark' };
}

// --- Zoom/Pan ---
const zoom = { scale: 1, x: 0, y: 0, min: 0.2, max: 40, content: null };
function ensureZoomContent(){
  const svg = els.preview.querySelector('svg');
  if (!svg) return;
  if (svg.parentElement && svg.parentElement.classList.contains('zoom-content')){
    zoom.content = svg.parentElement;
    return;
  }
  const wrapper = document.createElement('div');
  wrapper.className = 'zoom-content';
  els.preview.replaceChildren(wrapper);
  wrapper.appendChild(svg);
  zoom.content = wrapper;
}
function applyZoomTransform(){
  if (!zoom.content) return;
  zoom.content.style.transform = `translate(${zoom.x}px, ${zoom.y}px) scale(${zoom.scale})`;
}
function resetZoom(){ 
  // Check if current diagram is a mindmap by looking for the mindmap SVG structure
  const currentCode = els.code.value || state.diagram;
  if (currentCode.trim().startsWith('mindmap')) {
    const mindmapRenderer = getMindmapRenderer();
    if (mindmapRenderer) {
      mindmapRenderer.resetZoom();
      return;
    }
  }
  // Regular zoom reset for other diagrams
  zoom.scale = 1; zoom.x = 0; zoom.y = 0; applyZoomTransform();
}
function zoomBy(factor, cx, cy){
  // Check if current diagram is a mindmap
  const currentCode = els.code.value || state.diagram;
  if (currentCode.trim().startsWith('mindmap')) {
    const mindmapRenderer = getMindmapRenderer();
    if (mindmapRenderer) {
      if (factor > 1) {
        mindmapRenderer.zoomIn();
      } else {
        mindmapRenderer.zoomOut();
      }
      return;
    }
  }
  // Regular zoom for other diagrams
  const old = zoom.scale;
  let next = old * factor;
  next = Math.max(zoom.min, Math.min(zoom.max, next));
  factor = next / old;
  if (!Number.isFinite(factor) || factor === 1) return;
  const rect = els.preview.getBoundingClientRect();
  const mx = (cx ?? (rect.left + rect.width/2)) - rect.left;
  const my = (cy ?? (rect.top + rect.height/2)) - rect.top;
  zoom.x = mx - (mx - zoom.x) * factor;
  zoom.y = my - (my - zoom.y) * factor;
  zoom.scale = next;
  applyZoomTransform();
}
function initZoom(){
  let dragging = false; let lastX = 0; let lastY = 0;
  els.preview.addEventListener('wheel', (e) => {
    e.preventDefault();
    const denom = e.shiftKey ? 150 : 300; // hold Shift for faster zoom
    const k = Math.exp(-e.deltaY / denom);
    zoomBy(k, e.clientX, e.clientY);
  }, { passive: false });
  els.preview.addEventListener('mousedown', (e) => { if (!zoom.content) return; dragging = true; zoom.content.classList.add('dragging'); lastX = e.clientX; lastY = e.clientY; });
  window.addEventListener('mousemove', (e) => { if (!dragging) return; const dx = e.clientX - lastX; const dy = e.clientY - lastY; lastX = e.clientX; lastY = e.clientY; zoom.x += dx; zoom.y += dy; applyZoomTransform(); });
  window.addEventListener('mouseup', () => { if (!dragging) return; dragging = false; if (zoom.content) zoom.content.classList.remove('dragging'); });
  els.preview.addEventListener('dblclick', () => resetZoom());
  if (els.zoomIn) els.zoomIn.addEventListener('click', () => zoomBy(1.3));
  if (els.zoomOut) els.zoomOut.addEventListener('click', () => zoomBy(1/1.3));
  if (els.zoomReset) els.zoomReset.addEventListener('click', () => resetZoom());
}

function labelForTheme(key){
  const map = {
    dark: 'Dark', default: 'Default', forest: 'Forest', neutral: 'Neutral',
    slate: 'Slate', ocean: 'Ocean', emerald: 'Emerald', sunset: 'Sunset',
    rose: 'Rose', cyberpunk: 'Cyberpunk', grayscale: 'Grayscale', highcontrast: 'High Contrast',
    pastel: 'Pastel', halloween: 'Halloween'
  };
  return map[key] || key;
}

main();
