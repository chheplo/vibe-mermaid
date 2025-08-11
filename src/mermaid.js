import { MindmapRenderer } from './mindmap-renderer.js';

let mermaidLib = null;
let lastSvg = '';
let mindmapRenderer = null;
let d3Lib = null;

// Export the mindmap renderer for zoom controls
export function getMindmapRenderer() {
  return mindmapRenderer;
}

async function loadD3() {
  // D3 is now loaded via script tag in HTML
  // Just wait for it to be available
  if (window.d3) {
    return window.d3;
  }
  
  // Wait for D3 to be available (in case script hasn't loaded yet)
  return new Promise((resolve, reject) => {
    let attempts = 0;
    const checkD3 = setInterval(() => {
      attempts++;
      if (window.d3 && window.d3.select) {
        clearInterval(checkD3);
        console.log('D3 is ready');
        resolve(window.d3);
      } else if (attempts > 50) { // 5 seconds timeout
        clearInterval(checkD3);
        reject(new Error('D3 failed to load after 5 seconds'));
      }
    }, 100);
  });
}

export async function initMermaid(){
  if (mermaidLib) return;
  mermaidLib = await import('https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.esm.min.mjs');
  mermaidLib.default.initialize({ 
    startOnLoad: false, 
    securityLevel: 'loose', 
    theme: 'dark',
    mindmap: {
      useMaxWidth: false,
      padding: 10,
      maxTextSize: 100
    },
    flowchart: {
      useMaxWidth: true,
      htmlLabels: true,
      curve: 'basis'
    }
  });
}

export async function renderDiagram(code, container){
  if (!mermaidLib) await initMermaid();
  
  try {
    if (!code || !code.trim()){
      lastSvg = '';
      container.innerHTML = '<div style="color:var(--muted);text-align:center;padding:24px;">No diagram yet. Use chat or code editor to begin.</div>';
      return;
    }
    
    // Check if it's a mindmap diagram
    if (code.trim().startsWith('mindmap')) {
      // Use custom mindmap renderer
      try {
        await loadD3();
        
        // Double-check D3 is loaded
        if (!window.d3) {
          throw new Error('D3 library failed to load');
        }
        
        if (!mindmapRenderer || mindmapRenderer.container !== container) {
          mindmapRenderer = new MindmapRenderer(container);
        }
        mindmapRenderer.render(code);
        
        // Store SVG for export
        const svgElement = container.querySelector('svg');
        if (svgElement) {
          lastSvg = svgElement.outerHTML;
        }
      } catch (err) {
        console.error('Mindmap rendering error:', err);
        container.innerHTML = `<div style="color:#ffb4b4; padding:20px;">
          Error rendering mindmap: ${err.message}<br>
          <small>Try refreshing the page or use a different diagram type.</small>
        </div>`;
      }
    } else {
      // Use Mermaid for other diagram types
      const id = 'mmd-' + Math.random().toString(36).slice(2);
      const { svg } = await mermaidLib.default.render(id, code);
      container.innerHTML = svg;
      lastSvg = svg;
    }
  } catch (e){
    container.innerHTML = `<pre style="color:#ffb4b4; white-space: pre-wrap;">${escapeHtml(e.message||String(e))}</pre>`;
  }
}

export function getSvgString(){
  if (lastSvg) return Promise.resolve(lastSvg);
  const el = document.querySelector('#preview-container svg');
  return Promise.resolve(el ? el.outerHTML : '');
}

export function setTheme(theme, themeVariables){
  if (!mermaidLib) return;
  const opts = { 
    startOnLoad: false, 
    securityLevel: 'loose', 
    theme,
    mindmap: {
      useMaxWidth: false,
      padding: 10,
      maxTextSize: 100
    },
    flowchart: {
      useMaxWidth: true,
      htmlLabels: true,
      curve: 'basis'
    }
  };
  if (themeVariables) opts.themeVariables = themeVariables;
  mermaidLib.default.initialize(opts);
}

function escapeHtml(s){
  return s.replace(/[&<>\"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
}
