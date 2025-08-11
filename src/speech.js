export function initSpeech(btnMic, inputEl){
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR){ btnMic.title = 'Speech not supported'; btnMic.disabled = true; return; }

  const rec = new SR();
  rec.lang = 'en-US';
  rec.interimResults = true;
  rec.continuous = true;
  rec.maxAlternatives = 1;

  let active = false;
  let baseText = '';
  let finalText = '';

  // UI indicator
  const container = btnMic.parentElement; // .chat-input
  let indicator = null;
  function showIndicator(){
    if (indicator) return;
    indicator = document.createElement('div');
    indicator.className = 'listening-overlay';
    indicator.innerHTML = `
      <div class="listening-content">
        <div class="listening-animation">
          <span class="wave"></span>
          <span class="wave"></span>
          <span class="wave"></span>
          <span class="wave"></span>
          <span class="wave"></span>
        </div>
        <div class="listening-text">Listening...</div>
        <button class="listening-stop">Stop</button>
      </div>
    `;
    container.appendChild(indicator);
    
    // Add stop button handler
    const stopBtn = indicator.querySelector('.listening-stop');
    if (stopBtn) {
      stopBtn.addEventListener('click', () => {
        active = false; 
        try{ rec.stop(); }catch{} 
        btnMic.textContent='🎤'; 
        hideIndicator();
      });
    }
  }
  function hideIndicator(){ if (indicator){ indicator.remove(); indicator = null; } }

  rec.onresult = (e) => {
    let interim = '';
    for (let i = e.resultIndex; i < e.results.length; i++){
      const res = e.results[i];
      const t = (res[0]?.transcript || '').trim();
      if (!t) continue;
      if (res.isFinal){ finalText = finalText ? `${finalText} ${t}` : t; }
      else { interim = interim ? `${interim} ${t}` : t; }
    }
    const parts = [baseText, finalText, interim].filter(Boolean);
    const text = parts.join(parts.length > 1 ? ' ' : '');
    const pos = text.length;
    inputEl.value = text;
    try{ inputEl.setSelectionRange(pos, pos); }catch{}
    inputEl.dispatchEvent(new Event('input'));
  };
  rec.onerror = () => { if (!active) return; /* keep UI state until onend restarts or user stops */ };
  rec.onend = () => { if (active){ try { rec.start(); } catch {} } else { btnMic.textContent = '🎤'; hideIndicator(); } };

  btnMic.addEventListener('click', () => {
    try {
      if (active){
        active = false; rec.stop(); btnMic.textContent = '🎤'; hideIndicator();
      } else {
        baseText = inputEl.value.trim(); finalText = '';
        active = true; rec.start(); btnMic.textContent = '⏹'; showIndicator();
      }
    } catch {}
  });

}
