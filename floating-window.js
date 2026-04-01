const VCP_URL = 'https://vcp.21cn.com/';

let isExpanded = false;
let isDragging = false;
let dragStartX, dragStartY;
let initialLeft, initialTop;

function createFloatingWindow() {
  const container = document.createElement('div');
  container.id = 'vcp-float-window';
  container.innerHTML = `
    <div id="vcp-collapsed-view">
      <span id="vcp-collapsed-icon">🍪</span>
    </div>
    <div id="vcp-expanded-view">
      <div id="vcp-header">
        <h2>🍪 VCP 数据提取</h2>
        <button id="vcp-close-btn">✕</button>
      </div>
      <div id="vcp-content-area">
        <div class="vcp-empty-state">
          <div class="vcp-empty-state-icon">🔒</div>
          <p>请先登录 vcp.21cn.com</p>
        </div>
      </div>
      <div class="vcp-action-btns">
        <button id="vcp-refresh-btn" class="vcp-btn vcp-btn-secondary">🔄 刷新</button>
        <button id="vcp-login-btn" class="vcp-btn vcp-btn-primary">打开登录页</button>
      </div>
    </div>
    <div id="vcp-status"></div>
  `;
  
  document.body.appendChild(container);
  
  addStyles();
  addEventListeners();
  
  return container;
}

function addStyles() {
  const style = document.createElement('style');
  style.textContent = `
    #vcp-float-window {
      position: fixed;
      top: 20px;
      right: 20px;
      width: 70px;
      height: 70px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      overflow: hidden;
      transition: all 0.4s cubic-bezier(0.25, 0.8, 0.25, 1);
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      border-radius: 35px;
      box-shadow: 0 4px 20px rgba(102, 126, 234, 0.4);
      z-index: 2147483647;
    }
    
    #vcp-float-window.expanded {
      width: 420px;
      height: auto;
      min-height: 520px;
      max-height: 620px;
      border-radius: 24px;
      background: #fff;
      overflow-y: auto;
      box-shadow: 0 8px 40px rgba(0, 0, 0, 0.15);
    }
    
    #vcp-collapsed-view {
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: transform 0.2s ease;
      user-select: none;
    }
    
    #vcp-collapsed-view:active {
      transform: scale(0.92);
    }
    
    #vcp-collapsed-icon {
      font-size: 32px;
      filter: drop-shadow(0 2px 6px rgba(0,0,0,0.3));
    }
    
    #vcp-expanded-view {
      display: none;
      padding: 24px;
      opacity: 0;
      transition: opacity 0.3s ease 0.1s;
    }
    
    #vcp-float-window.expanded #vcp-expanded-view {
      display: block;
      opacity: 1;
    }
    
    #vcp-float-window.expanded #vcp-collapsed-view {
      display: none;
    }
    
    #vcp-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
      padding-bottom: 16px;
      border-bottom: 1px solid #f0f0f0;
      cursor: move;
      user-select: none;
    }
    
    #vcp-header h2 {
      font-size: 18px;
      color: #333;
      font-weight: 600;
      margin: 0;
    }
    
    #vcp-close-btn {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      border: none;
      background: #f5f5f5;
      cursor: pointer;
      font-size: 16px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s ease;
    }
    
    #vcp-close-btn:hover {
      background: #e8e8e8;
      transform: rotate(90deg);
    }
    
    #vcp-close-btn:active {
      transform: scale(0.9) rotate(90deg);
    }
    
    .vcp-section {
      margin-bottom: 14px;
      background: #fafafa;
      border-radius: 16px;
      overflow: hidden;
      transition: all 0.3s ease;
    }
    
    .vcp-section-header {
      padding: 14px 18px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      cursor: pointer;
      background: #fff;
      border: 1px solid #f0f0f0;
      border-radius: 16px;
      transition: all 0.2s ease;
    }
    
    .vcp-section-header:hover {
      background: #f8f8f8;
      border-color: #e0e0e0;
    }
    
    .vcp-section-header:active {
      transform: scale(0.98);
    }
    
    .vcp-section-title {
      font-weight: 500;
      color: #333;
      font-size: 14px;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    
    .vcp-section-arrow {
      transition: transform 0.3s ease;
      font-size: 13px;
      color: #aaa;
    }
    
    .vcp-section.expanded .vcp-section-arrow {
      transform: rotate(180deg);
    }
    
    .vcp-section-content {
      max-height: 0;
      overflow: hidden;
      transition: max-height 0.3s ease, padding 0.3s ease;
    }
    
    .vcp-section.expanded .vcp-section-content {
      max-height: 220px;
      padding: 0 18px 18px 18px;
    }
    
    .vcp-content-box {
      background: #fff;
      border: 1px solid #f0f0f0;
      border-radius: 12px;
      padding: 12px;
      max-height: 160px;
      overflow-y: auto;
      word-break: break-all;
      font-family: 'SF Mono', Monaco, 'Courier New', monospace;
      font-size: 11px;
      line-height: 1.6;
      color: #555;
    }
    
    .vcp-content-box::-webkit-scrollbar {
      width: 6px;
    }
    
    .vcp-content-box::-webkit-scrollbar-track {
      background: #f5f5f5;
      border-radius: 3px;
    }
    
    .vcp-content-box::-webkit-scrollbar-thumb {
      background: #ddd;
      border-radius: 3px;
    }
    
    .vcp-copy-btn {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border: none;
      padding: 7px 14px;
      border-radius: 8px;
      cursor: pointer;
      font-size: 12px;
      font-weight: 500;
      transition: all 0.2s ease;
      opacity: 0;
      transform: translateY(-5px);
    }
    
    .vcp-section.expanded .vcp-copy-btn {
      opacity: 1;
      transform: translateY(0);
    }
    
    .vcp-copy-btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 14px rgba(102, 126, 234, 0.4);
    }
    
    .vcp-copy-btn:active {
      transform: scale(0.95);
    }
    
    .vcp-action-btns {
      display: flex;
      gap: 12px;
      margin-top: 18px;
    }
    
    .vcp-btn {
      flex: 1;
      padding: 14px;
      border: none;
      border-radius: 14px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s ease;
    }
    
    .vcp-btn-primary {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
    }
    
    .vcp-btn-primary:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 24px rgba(102, 126, 234, 0.4);
    }
    
    .vcp-btn-primary:active {
      transform: scale(0.98);
    }
    
    .vcp-btn-secondary {
      background: #f5f5f5;
      color: #333;
    }
    
    .vcp-btn-secondary:hover {
      background: #ebebeb;
    }
    
    .vcp-btn-secondary:active {
      transform: scale(0.98);
    }
    
    #vcp-status {
      position: fixed;
      top: 12px;
      left: 50%;
      transform: translateX(-50%) translateY(-50px);
      padding: 12px 24px;
      border-radius: 24px;
      font-size: 14px;
      font-weight: 500;
      opacity: 0;
      transition: all 0.3s ease;
      z-index: 2147483648;
      white-space: nowrap;
    }
    
    #vcp-status.show {
      transform: translateX(-50%) translateY(0);
      opacity: 1;
    }
    
    #vcp-status.success {
      background: #34c759;
      color: white;
      box-shadow: 0 4px 16px rgba(52, 199, 89, 0.3);
    }
    
    #vcp-status.error {
      background: #ff3b30;
      color: white;
      box-shadow: 0 4px 16px rgba(255, 59, 48, 0.3);
    }
    
    .vcp-empty-state {
      text-align: center;
      padding: 40px 24px;
      color: #999;
    }
    
    .vcp-empty-state-icon {
      font-size: 48px;
      margin-bottom: 12px;
      opacity: 0.5;
    }
    
    .vcp-loading {
      display: inline-block;
      width: 18px;
      height: 18px;
      border: 2px solid #f3f3f3;
      border-top: 2px solid #667eea;
      border-radius: 50%;
      animation: vcp-spin 0.8s linear infinite;
    }
    
    @keyframes vcp-spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
  `;
  
  document.head.appendChild(style);
}

function showStatus(message, isError = false) {
  const statusEl = document.getElementById('vcp-status');
  statusEl.textContent = message;
  statusEl.className = (isError ? 'error' : 'success') + ' show';
  setTimeout(() => {
    statusEl.classList.remove('show');
  }, 2500);
}

function copyToClipboard(text) {
  navigator.clipboard.writeText(text).then(() => {
    showStatus('✓ 已复制');
  }).catch(err => {
    showStatus('✗ 复制失败', true);
  });
}

function toggleExpand() {
  isExpanded = !isExpanded;
  document.getElementById('vcp-float-window').classList.toggle('expanded', isExpanded);
  
  if (isExpanded) {
    fetchData();
  }
}

function createSection(id, title, icon, content, isJson = false) {
  const displayContent = isJson ? JSON.stringify(content, null, 2) : (content || '(未找到)');
  
  return `
    <div class="vcp-section" id="vcp-section-${id}">
      <div class="vcp-section-header" onclick="window.vcpToggleSection('${id}')">
        <span class="vcp-section-title">${icon} ${title}</span>
        <div style="display: flex; align-items: center; gap: 10px;">
          <button class="vcp-copy-btn" onclick="event.stopPropagation(); window.vcpCopySection('${id}')">复制</button>
          <span class="vcp-section-arrow">▼</span>
        </div>
      </div>
      <div class="vcp-section-content">
        <div class="vcp-content-box" id="vcp-content-${id}">${escapeHtml(displayContent)}</div>
      </div>
    </div>
  `;
}

window.vcpToggleSection = function(id) {
  const section = document.getElementById(`vcp-section-${id}`);
  section.classList.toggle('expanded');
};

window.vcpCopySection = function(id) {
  const content = document.getElementById(`vcp-content-${id}`).textContent;
  copyToClipboard(content);
};

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

async function fetchData() {
  const contentArea = document.getElementById('vcp-content-area');
  
  if (!window.location.href.includes('vcp.21cn.com')) {
    contentArea.innerHTML = `
      <div class="vcp-empty-state">
        <div class="vcp-empty-state-icon">🌐</div>
        <p>当前不在 vcp.21cn.com 页面</p>
        <p style="font-size: 12px; margin-top: 8px;">请点击"打开登录页"按钮</p>
      </div>
    `;
    return;
  }

  contentArea.innerHTML = '<div class="vcp-empty-state"><div class="vcp-loading"></div><p>加载中...</p></div>';

  try {
    const safeVillageCookie = localStorage.getItem('safeVillageCookie');
    const allStorage = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      allStorage[key] = localStorage.getItem(key);
    }
    
    const cookies = await chrome.runtime.sendMessage({ action: 'getCookies' });
    
    const headersResult = await chrome.storage.local.get(['capturedHeaders']);
    const headers = headersResult.capturedHeaders || { headers: {}, url: '', timestamp: '' };

    let html = '';
    
    html += createSection('cookie', 'safeVillageCookie', '📦', safeVillageCookie);
    html += createSection('cookies', 'Cookies', '🍪', cookies, true);
    html += createSection('headers', '请求头 Headers', '📋', headers, true);
    html += createSection('storage', '全部 localStorage', '💾', allStorage, true);
    
    contentArea.innerHTML = html;
    
    showStatus('✓ 数据已更新');
  } catch (err) {
    contentArea.innerHTML = `
      <div class="vcp-empty-state">
        <div class="vcp-empty-state-icon">⚠️</div>
        <p>获取数据失败</p>
        <p style="font-size: 11px; margin-top: 8px; color: #ff3b30;">${err.message}</p>
      </div>
    `;
    showStatus('✗ 获取失败', true);
  }
}

function initDrag() {
  const dragHandle = document.getElementById('vcp-header');
  const container = document.getElementById('vcp-float-window');
  
  dragHandle.addEventListener('mousedown', (e) => {
    if (e.target.closest('#vcp-close-btn')) return;
    
    isDragging = true;
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    
    const rect = container.getBoundingClientRect();
    initialLeft = rect.left;
    initialTop = rect.top;
    
    container.style.transition = 'none';
    
    e.preventDefault();
  });
  
  document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    
    const deltaX = e.clientX - dragStartX;
    const deltaY = e.clientY - dragStartY;
    
    container.style.left = (initialLeft + deltaX) + 'px';
    container.style.top = (initialTop + deltaY) + 'px';
    container.style.right = 'auto';
  });
  
  document.addEventListener('mouseup', () => {
    if (isDragging) {
      isDragging = false;
      container.style.transition = 'all 0.4s cubic-bezier(0.25, 0.8, 0.25, 1)';
    }
  });
}

function addEventListeners() {
  document.getElementById('vcp-collapsed-view').addEventListener('click', toggleExpand);
  document.getElementById('vcp-close-btn').addEventListener('click', toggleExpand);
  
  document.getElementById('vcp-login-btn').addEventListener('click', () => {
    if (window.location.href.includes('vcp.21cn.com')) {
      window.location.href = VCP_URL;
    } else {
      window.open(VCP_URL, '_blank');
    }
  });
  
  document.getElementById('vcp-refresh-btn').addEventListener('click', fetchData);
  
  initDrag();
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'toggleFloatingWindow') {
    toggleExpand();
  }
  if (request.action === 'getLocalStorage') {
    const safeVillageCookie = localStorage.getItem('safeVillageCookie');
    const allStorage = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      allStorage[key] = localStorage.getItem(key);
    }
    sendResponse({ safeVillageCookie, allStorage });
  }
  return true;
});

if (!document.getElementById('vcp-float-window')) {
  createFloatingWindow();
}
