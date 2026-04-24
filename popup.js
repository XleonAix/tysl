function showStatus(message, isError = false) {
  const statusEl = document.getElementById('status');
  statusEl.innerHTML = message;
  statusEl.className = 'status ' + (isError ? 'error' : 'success');
  statusEl.classList.remove('hidden');
  setTimeout(() => {
    statusEl.classList.add('hidden');
  }, 3000);
}

function updateProgress(percent, text) {
  const progressFill = document.getElementById('progressFill');
  const progressPercent = document.getElementById('progressPercent');
  const progressText = document.getElementById('progressText');
  
  if (progressFill) {
    progressFill.style.width = percent + '%';
  }
  if (progressPercent) {
    progressPercent.textContent = Math.round(percent) + '%';
  }
  if (progressText) {
    progressText.textContent = text;
  }
}

// 全局变量：是否停止查询
let shouldStopQuery = false;

function copyToClipboard(text) {
  navigator.clipboard.writeText(text).then(() => {
    showStatus('已复制到剪贴板');
  }).catch(err => {
    showStatus('复制失败: ' + err, true);
  });
}

async function getVcpTab() {
  const tabs = await chrome.tabs.query({ active: true });
  for (const tab of tabs) {
    if (tab.url && tab.url.includes('vcp.21cn.com')) {
      return tab;
    }
  }
  const allTabs = await chrome.tabs.query({});
  for (const tab of allTabs) {
    if (tab.url && tab.url.includes('vcp.21cn.com')) {
      return tab;
    }
  }
  return null;
}

const VCP_LOGIN_TIP = '请先登录 <a href="https://vcp.21cn.com/vcpCamera/web/index.html#/nopasslogin" target="_blank">天翼云眼视频监控平台</a>';

async function ensureVcpTab(injectScript = true) {
  const tab = await getVcpTab();
  if (!tab) {
    showStatus(VCP_LOGIN_TIP, true);
    return null;
  }
  if (injectScript) {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content.js']
    });
  }
  return tab;
}

async function sendVcpMessage(action, data = {}, injectScript = true) {
  const tab = await ensureVcpTab(injectScript);
  if (!tab) return null;
  return await chrome.tabs.sendMessage(tab.id, { action, ...data });
}

function validatePhoneAccount(userId, account) {
  if (!userId || !account) {
    showStatus('请确保已获取用户ID并输入账号', true);
    return false;
  }
  if (!/^1[3-9]\d{9}$/.test(account)) {
    showStatus('请输入11位手机号', true);
    return false;
  }
  return true;
}

function renderUploadStatsHtml(result) {
  return `
    <div style="overflow-x: auto;">
      <table class="data-table" style="margin-top: 8px; width: 100%; border-collapse: collapse; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08); background: rgba(255, 255, 255, 0.8); backdrop-filter: blur(10px); border: 1px solid rgba(226, 232, 240, 0.5);">
        <tr style="background: linear-gradient(135deg, rgba(248, 250, 252, 0.9) 0%, rgba(241, 245, 249, 0.9) 100%); border-bottom: 1px solid rgba(226, 232, 240, 0.5); backdrop-filter: blur(10px);">
          <th style="padding: 12px 14px; text-align: left; border: 1px solid rgba(226, 232, 240, 0.5); font-weight: 700; font-size: 9px; color: #1e293b; letter-spacing: -0.2px; text-transform: uppercase;">总上传条数</th>
          <th style="padding: 12px 14px; text-align: left; border: 1px solid rgba(226, 232, 240, 0.5); font-weight: 700; font-size: 9px; color: #1e293b; letter-spacing: -0.2px; text-transform: uppercase;">重复条数</th>
          <th style="padding: 12px 14px; text-align: left; border: 1px solid rgba(226, 232, 240, 0.5); font-weight: 700; font-size: 9px; color: #1e293b; letter-spacing: -0.2px; text-transform: uppercase;">有效条数</th>
        </tr>
        <tr style="border-bottom: 1px solid rgba(226, 232, 240, 0.5); transition: all 0.2s ease; font-size: 10px;">
          <td style="padding: 12px 14px; border: 1px solid rgba(226, 232, 240, 0.5); color: #475569; font-weight: 500;">${result.totalUpload}</td>
          <td style="padding: 12px 14px; border: 1px solid rgba(226, 232, 240, 0.5); color: #c5221f; font-weight: 600;">${result.duplicateCount}</td>
          <td style="padding: 12px 14px; border: 1px solid rgba(226, 232, 240, 0.5); color: #137333; font-weight: 600;">${result.validCount}</td>
        </tr>
      </table>
    </div>
  `;
}

function exportToCSV(filename, headers, rows) {
  if (!rows || rows.length === 0) {
    showStatus('没有可导出的数据', true);
    return;
  }
  const csvContent = `${headers}\n${rows.join('\n')}`;
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const now = new Date();
  const timestamp = now.toISOString().slice(0, 10).replace(/-/g, '') +
    now.toTimeString().slice(0, 8).replace(/:/g, '');
  a.download = `${filename}_${timestamp}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showStatus('导出成功');
}

function setupDropZone(config) {
  const { dropZoneId, fileInputId, processFn } = config;
  const dropZone = document.getElementById(dropZoneId);
  const fileInput = document.getElementById(fileInputId);
  if (!dropZone || !fileInput) return;

  dropZone.addEventListener('click', () => fileInput.click());
  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.style.borderColor = '#4285f4';
    dropZone.style.backgroundColor = '#f0f7ff';
  });
  dropZone.addEventListener('dragleave', () => {
    dropZone.style.borderColor = '#ddd';
    dropZone.style.backgroundColor = '#f9f9f9';
  });
  dropZone.addEventListener('drop', async (e) => {
    e.preventDefault();
    dropZone.style.borderColor = '#ddd';
    dropZone.style.backgroundColor = '#f9f9f9';
    if (e.dataTransfer.files.length) {
      const file = e.dataTransfer.files[0];
      if (file.name.endsWith('.csv')) {
        fileInput.files = e.dataTransfer.files;
        await processFn(file);
      } else {
        showStatus('请上传CSV文件 (.csv)', true);
      }
    }
  });
  fileInput.addEventListener('change', async (e) => {
    if (e.target.files.length) {
      await processFn(e.target.files[0]);
    }
  });
}

async function fetchData() {
  const tab = await ensureVcpTab(false);
  if (!tab) return;

  try {
    const response = await chrome.runtime.sendMessage({ action: 'getCookies' });
    const safeVillageCookie = response['safeVillageCookie'];
    
    if (safeVillageCookie) {
      const cookieFormat = `COOKIE = "safeVillageCookie=${safeVillageCookie}"`;
      document.getElementById('cookieFormat').textContent = cookieFormat;
      showStatus('数据获取成功');
    } else {
      document.getElementById('cookieFormat').textContent = '(未找到 safeVillageCookie)';
      showStatus(VCP_LOGIN_TIP, true);
    }
  } catch (err) {
    console.error('获取数据失败:', err);
    showStatus('获取数据失败: ' + err.message, true);
  }
}

async function getUserRegionList(userId) {
  try {
    const response = await sendVcpMessage('getUserRegionList', { userId });
    if (!response) return;
    
    if (response.success) {
      showStatus('获取区域代码成功');
    } else {
      showStatus('获取区域代码失败: ' + response.error, true);
    }
  } catch (err) {
    console.error('获取区域代码失败:', err);
    showStatus('获取区域代码失败: ' + err.message, true);
  }
}

async function getCustomList() {
  const userId = currentUserId;
  const account = document.getElementById('enteraccount').value.trim();
  
  if (!validatePhoneAccount(userId, account)) return;
  
  clearRegionData();
  
  try {
    const response = await sendVcpMessage('getCustomList', { userId, account });
    if (!response) return;
    
    if (response.success) {
      const customData = response.data;
      console.log('getCustomList response:', response);
      
      if (customData && customData.data && customData.data.list) {
        const list = customData.data.list;
        console.log('Custom list:', list);
        const qiyezhuList = list.filter(item => item.roleName === '企业主');
        console.log('Qiyezhu list:', qiyezhuList);
        
        if (qiyezhuList.length > 0) {
          const qiyezhu = qiyezhuList[0];
          console.log('Qiyezhu data:', qiyezhu);
          showStatus('该账户是企业主，正在获取监控目录...');
          
          const useDeviceCount = qiyezhu.useDeviceCount || 0;
          const deviceCount = qiyezhu.deviceCount || 0;
          console.log('Cascade service info:', useDeviceCount, '/', deviceCount);
          currentCascadeServiceInfo = `级联服务: ${useDeviceCount}/${deviceCount}`;
          console.log('Current cascade service info:', currentCascadeServiceInfo);
          
          await getUserRegionList(qiyezhu.id);
          await getLevelCusRegion();
        } else {
          document.getElementById('customListResult').style.display = 'block';
          document.getElementById('customList').textContent = '该账户不是企业主';
          showStatus('该账户不是企业主', true);
        }
      } else {
        document.getElementById('customListResult').style.display = 'block';
        document.getElementById('customList').textContent = '未获取到数据';
        showStatus('获取客户列表失败', true);
      }
    } else {
      showStatus('获取客户列表失败: ' + response.error, true);
    }
  } catch (err) {
    console.error('获取客户列表失败:', err);
    showStatus('获取客户列表失败: ' + err.message, true);
  }
}

function clearRegionData() {
  document.getElementById('customListResult').style.display = 'none';
  document.getElementById('customList').innerHTML = '-';
  document.getElementById('levelCusRegionResult').style.display = 'none';
  document.getElementById('levelCusRegion').innerHTML = '-';
  const cascadeServiceInfo = document.getElementById('cascadeServiceInfo');
  if (cascadeServiceInfo) {
    cascadeServiceInfo.textContent = '';
  }
  currentCascadeServiceInfo = '';
}

async function getLevelCusRegion() {
  try {
    const response = await sendVcpMessage('getLevelCusRegion');
    if (!response) return;
    
    if (response.success) {
      const regionData = response.data;
      
      if (regionData && regionData.data && regionData.data.cusRegionList) {
        const regionList = regionData.data.cusRegionList;
        const regionHtml = renderRegionTree(regionList);
        
        document.getElementById('levelCusRegionResult').style.display = 'block';
        document.getElementById('levelCusRegion').innerHTML = regionHtml;
        
        const cascadeServiceInfo = document.getElementById('cascadeServiceInfo');
        if (cascadeServiceInfo && currentCascadeServiceInfo) {
          console.log('Displaying cascade service info:', currentCascadeServiceInfo);
          cascadeServiceInfo.textContent = currentCascadeServiceInfo;
        } else {
          console.log('No cascade service info to display');
        }
        
        showStatus('获取监控目录成功');
        
        addRegionClickHandlers();
      } else {
        document.getElementById('levelCusRegionResult').style.display = 'block';
        document.getElementById('levelCusRegion').textContent = '未获取到监控目录数据';
        showStatus('获取监控目录失败', true);
      }
    } else {
      showStatus('获取监控目录失败: ' + response.error, true);
    }
  } catch (err) {
    console.error('获取监控目录失败:', err);
    showStatus('获取监控目录失败: ' + err.message, true);
  }
}

function renderRegionTree(regionList, level = 0) {
  if (!regionList || regionList.length === 0) {
    return '<div class="no-data">暂无数据</div>';
  }
  
  let html = '<ul class="region-tree">';
  
  regionList.forEach(item => {
    const indent = level * 20;
    const hasChild = item.hasChild === 1 || item.hasChild === '1' || item.hasChild === true;
    const toggleIcon = hasChild ? '▶' : '•';
    
    html += `
      <li class="region-item" style="padding-left: ${indent}px; display: flex; align-items: center; justify-content: space-between;" data-id="${item.id}" data-name="${item.name || ''}" data-has-child="${hasChild}">
        <div style="display: flex; align-items: center; gap: 8px;">
          <span class="region-toggle">${toggleIcon}</span>
          <input type="radio" name="region-radio" class="region-radio" data-id="${item.id}" data-name="${item.name || ''}">
          <span class="region-name">${item.name || '未命名'}</span>
          <span class="region-id">(ID: ${item.id})</span>
          <span class="region-device-count" style="font-size: 10px; color: #64748b; font-weight: 500;">(${item.onlineCount || 0}/${item.deviceCount || 0})</span>
        </div>
        <div style="display: flex; gap: 4px;">
          <button class="add-subregion-btn" data-id="${item.id}" style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 12px; font-weight: bold; box-shadow: 0 2px 6px rgba(16, 185, 129, 0.25); border: 1px solid rgba(255, 255, 255, 0.3);">+</button>
          <button class="edit-region-btn" data-id="${item.id}" data-name="${item.name || ''}" style="background: linear-gradient(135deg, #3b82f6 0%, #60a5fa 100%); color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 12px; font-weight: bold; box-shadow: 0 2px 6px rgba(59, 130, 246, 0.25); border: 1px solid rgba(255, 255, 255, 0.3);">✏️</button>
          <button class="delete-region-btn" data-id="${item.id}" style="background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 12px; font-weight: bold; box-shadow: 0 2px 6px rgba(239, 68, 68, 0.25); border: 1px solid rgba(255, 255, 255, 0.3);">✕</button>
        </div>
      </li>
    `;
    
    if (hasChild && item.children && item.children.length > 0) {
      html += renderRegionTree(item.children, level + 1);
    }
  });
  
  html += '</ul>';
  return html;
}

function addRegionClickHandlers() {
  document.querySelectorAll('.region-item').forEach(item => {
    const toggle = item.querySelector('.region-toggle');
    const radio = item.querySelector('.region-radio');
    const editBtn = item.querySelector('.edit-region-btn');
    const deleteBtn = item.querySelector('.delete-region-btn');
    const hasChild = item.getAttribute('data-has-child') === 'true';
    
    toggle.addEventListener('click', async (e) => {
      e.stopPropagation();
      
      const regionId = item.getAttribute('data-id');
      
      
      const childrenContainer = item.nextElementSibling;
      
      if (hasChild && childrenContainer && childrenContainer.classList.contains('region-tree')) {
        if (childrenContainer.style.display === 'none') {
          childrenContainer.style.display = 'block';
          toggle.textContent = '▼';
        } else {
          childrenContainer.style.display = 'none';
          toggle.textContent = '▶';
        }
      } else if (hasChild) {
        toggle.textContent = '⏳';
        
        try {
          const response = await sendVcpMessage('getLevelCusRegion', { cusRegionId: regionId }, false);
          if (!response) { toggle.textContent = '▶'; return; }
          
          if (response.success && response.data && response.data.data && response.data.data.cusRegionList) {
            const childHtml = renderRegionTree(response.data.data.cusRegionList, parseInt(item.style.paddingLeft || 0) / 20 + 1);
            
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = childHtml;
            const childUl = tempDiv.querySelector('.region-tree');
            
            item.insertAdjacentElement('afterend', childUl);
            
            toggle.textContent = '▼';
            addRegionClickHandlers();
          } else {
            toggle.textContent = '▶';
            showStatus('获取子目录失败', true);
          }
        } catch (err) {
          console.error('获取子目录失败:', err);
          toggle.textContent = '▶';
          showStatus('获取子目录失败: ' + err.message, true);
        }
      }
    });
    
    radio.addEventListener('change', (e) => {
      const regionId = radio.getAttribute('data-id');
      const regionName = radio.getAttribute('data-name');
      
      (async () => {
        await sendVcpMessage('setSelectedRegion', {
          regionId: regionId,
          regionName: regionName
        }, false);
      })();
    });
    
    const addSubregionBtn = item.querySelector('.add-subregion-btn');
    
    if (addSubregionBtn) {
      addSubregionBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const parentId = addSubregionBtn.getAttribute('data-id');
        
        const subregionName = prompt('请输入子目录名称:');
        if (subregionName && subregionName.trim()) {
          try {
            const response = await sendVcpMessage('saveRegion', {
              cusRegionNames: subregionName.trim(),
              cusRegionId: parentId,
              entUserId: '',
              isEdit: false
            }, false);
            if (!response) return;
            
            if (response.success) {
              showStatus('子目录添加成功');
              await getLevelCusRegionForRegionAdjust();
            } else {
              showStatus('子目录添加失败: ' + response.error, true);
            }
          } catch (err) {
            console.error('添加子目录失败:', err);
            showStatus('添加子目录失败: ' + err.message, true);
          }
        }
      });
    }
    
    if (editBtn) {
      editBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const regionId = editBtn.getAttribute('data-id');
        const regionName = editBtn.getAttribute('data-name');
        
        const newName = prompt('请输入新的目录名称:', regionName);
        if (newName && newName.trim() && newName !== regionName) {
          try {
            const response = await sendVcpMessage('saveRegion', {
              cusRegionNames: newName.trim(),
              cusRegionId: regionId,
              entUserId: '',
              isEdit: true
            }, false);
            if (!response) return;
            
            if (response.success) {
              showStatus('目录编辑成功');
              await getLevelCusRegionForRegionAdjust();
            } else {
              showStatus('目录编辑失败: ' + response.error, true);
            }
          } catch (err) {
            console.error('编辑目录失败:', err);
            showStatus('编辑目录失败: ' + err.message, true);
          }
        }
      });
    }
    
    if (deleteBtn) {
      deleteBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const regionId = deleteBtn.getAttribute('data-id');
        
        if (confirm('确定要删除该目录吗？')) {
          try {
            const response = await sendVcpMessage('deleteRegion', {
              cusRegionIds: regionId
            }, false);
            if (!response) return;
            
            if (response.success) {
              showStatus('目录删除成功');
              await getLevelCusRegionForRegionAdjust();
            } else {
              showStatus('目录删除失败: ' + response.error, true);
            }
          } catch (err) {
            console.error('删除目录失败:', err);
            showStatus('删除目录失败: ' + err.message, true);
          }
        }
      });
    }
  });
}



async function readCSVFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const text = e.target.result;
        const lines = text.split('\n');
        const deviceCodes = [];
        
        // 跳过表头，从第二行开始读取
        for (let i = 1; i < lines.length; i++) {
          const code = lines[i].trim();
          if (code) {
            deviceCodes.push(code);
          }
        }
        
        // 去重处理
        const totalUpload = deviceCodes.length;
        const uniqueCodes = [...new Set(deviceCodes)];
        const duplicateCount = totalUpload - uniqueCodes.length;
        const validCount = uniqueCodes.length;
        
        
        resolve({
          deviceCodes: uniqueCodes,
          totalUpload: totalUpload,
          duplicateCount: duplicateCount,
          validCount: validCount
        });
      } catch (err) {
        reject(err);
      }
    };
    
    reader.onerror = (e) => {
      reject(new Error('文件读取失败'));
    };
    
    reader.readAsText(file, 'UTF-8');
  });
}

async function processCSVFileCommon(file, config) {
  const { deviceCodesId, dropZoneId, uploadStatsId, uploadStatsContentId, excelFileId, reuploadBtnId } = config;
  try {
    const result = await readCSVFile(file);
    
    const deviceCodesGroup = document.getElementById(deviceCodesId).closest('.input-group');
    const uploadFileGroup = document.getElementById(dropZoneId).closest('.input-group');
    
    const reuploadBtnStyle = 'margin-top: 12px; width: 100%; background: linear-gradient(135deg, #3b82f6 0%, #60a5fa 100%); color: white; border: none; padding: 10px; border-radius: 10px; cursor: pointer; font-size: 11px; font-weight: 700; box-shadow: 0 4px 12px rgba(59, 130, 246, 0.25); letter-spacing: -0.2px; backdrop-filter: blur(10px); border: 1px solid rgba(255, 255, 255, 0.3); transition: all 0.25s ease;';
    const uploadStatsHtml = renderUploadStatsHtml(result) +
      `<button id="${reuploadBtnId}" style="${reuploadBtnStyle}">🔄 重新上传</button>`;
    
    document.getElementById(uploadStatsId).style.display = 'block';
    document.getElementById(uploadStatsContentId).innerHTML = uploadStatsHtml;
    
    if (deviceCodesGroup) deviceCodesGroup.style.display = 'none';
    if (uploadFileGroup) uploadFileGroup.style.display = 'none';
    
    document.getElementById(reuploadBtnId).addEventListener('click', () => {
      if (deviceCodesGroup) deviceCodesGroup.style.display = 'block';
      if (uploadFileGroup) uploadFileGroup.style.display = 'block';
      document.getElementById(uploadStatsId).style.display = 'none';
      document.getElementById(excelFileId).value = '';
      showStatus('可以重新上传文件');
    });
    
    showStatus(`CSV文件读取成功 - 总上传: ${result.totalUpload}条, 重复: ${result.duplicateCount}条, 有效: ${result.validCount}条`);
  } catch (err) {
    console.error('处理CSV文件失败:', err);
    showStatus('处理CSV文件失败: ' + err.message, true);
  }
}

async function processCSVFile(file) {
  await processCSVFileCommon(file, {
    deviceCodesId: 'deviceCodes',
    dropZoneId: 'dropZone',
    uploadStatsId: 'uploadStats',
    uploadStatsContentId: 'uploadStatsContent',
    excelFileId: 'excelFile',
    reuploadBtnId: 'reuploadBtn'
  });
}

async function createCascadeTask() {
  const userId = currentUserId;
  const account = document.getElementById('enteraccount').value.trim();
  
  if (!validatePhoneAccount(userId, account)) return;
  
  try {
    const tab = await ensureVcpTab();
    if (!tab) return;
    
    const deviceCodesInput = document.getElementById('deviceCodes').value.trim();
    const excelFile = document.getElementById('excelFile').files[0];
    
    let deviceCodeArray = [];
    
    if (excelFile) {
      try {
        const result = await readCSVFile(excelFile);
        deviceCodeArray = result.deviceCodes;
        showStatus(`使用已上传的CSV文件 - 有效: ${result.validCount}条`);
      } catch (err) {
        console.error('读取CSV文件失败:', err);
        showStatus('读取CSV文件失败: ' + err.message, true);
        return;
      }
    } else if (deviceCodesInput) {
      deviceCodeArray = deviceCodesInput.split(/\n|\r\n/).map(code => code.trim()).filter(code => code);
      document.getElementById('uploadFileLabel').style.display = 'none';
      document.getElementById('dropZone').style.display = 'none';
      document.getElementById('downloadTemplate').style.display = 'none';
    } else {
      showStatus('请输入设备编码或上传Excel文件', true);
      return;
    }
    
    if (deviceCodeArray.length === 0) {
      showStatus('设备编码列表为空', true);
      return;
    }
    
    // 隐藏CSV文件上传统计
    const uploadStats = document.getElementById('uploadStats');
    if (uploadStats) {
      uploadStats.style.display = 'none';
    }
    
    // 显示进度条
    const progressContainer = document.getElementById('progressContainer');
    if (progressContainer) {
      progressContainer.style.display = 'block';
    }
    updateProgress(0, '正在初始化...');
    
    // 监听进度更新
    const progressUpdateListener = (message) => {
      if (message.action === 'cascadeProgress') {
        const { progress, current, total, deviceCode, step } = message;
        updateProgress(progress, `${step}: 处理设备 ${current}/${total}: ${deviceCode}`);
      }
    };
    
    chrome.runtime.onMessage.addListener(progressUpdateListener);
    
    const deviceResponse = await chrome.tabs.sendMessage(tab.id, {
      action: 'getRegionsByDevTreeType',
      deviceCodes: deviceCodeArray
    });
    
    
    if (!deviceResponse.success) {
      showStatus('获取设备信息失败: ' + deviceResponse.error, true);
      // 隐藏进度条
      if (progressContainer) {
        progressContainer.style.display = 'none';
      }
      // 移除进度更新监听器
      chrome.runtime.onMessage.removeListener(progressUpdateListener);
      return;
    }
    
    let deviceList = deviceResponse.deviceList;
    
    // 找出获取失败的设备编码
    const successfulDeviceCodes = new Set(deviceList.map(device => device.deviceCode));
    const failedDeviceCodes = deviceCodeArray.filter(code => !successfulDeviceCodes.has(code));
    
    
    if (deviceList.length === 0) {
      showStatus('所有设备获取失败，请检查设备编码', true);
      // 隐藏进度条
      if (progressContainer) {
        progressContainer.style.display = 'none';
      }
      // 移除进度更新监听器
      chrome.runtime.onMessage.removeListener(progressUpdateListener);
      return;
    }
    
    // 询问用户是否确认级联
    const confirmMessage = `确认对 ${deviceList.length} 台设备进行级联操作？\n\n成功获取: ${deviceList.length} 台\n获取失败: ${failedDeviceCodes.length} 台`;
    
    if (!confirm(confirmMessage)) {
      showStatus('级联操作已取消', false);
      // 隐藏进度条
      if (progressContainer) {
        progressContainer.style.display = 'none';
      }
      // 移除进度更新监听器
      chrome.runtime.onMessage.removeListener(progressUpdateListener);
      return;
    }
    
    const response = await chrome.tabs.sendMessage(tab.id, {
      action: 'createCascadeTask',
      userId: userId,
      account: account,
      deviceList: deviceList
    });
    
    
    // 无论成功失败，都处理级联结果
    const resultData = response.data;
    const cascadeResults = response.cascadeResults || [];
    
    
    // 分类成功和失败的设备
    let successDevices = cascadeResults.filter(item => item.success);
    let failedDevices = cascadeResults.filter(item => !item.success);
    
    // 如果没有cascadeResults，根据响应状态生成默认结果
    if (cascadeResults.length === 0) {
      const isApiSuccess = response.success && (resultData?.code === 20000 || resultData?.code === 0 || resultData?.code === 200);
      const defaultResults = deviceList.map(device => ({
        deviceCode: device.deviceCode,
        regionId: device.regionId,
        regionName: device.regionName,
        deviceName: device.deviceName,
        success: isApiSuccess,
        message: isApiSuccess ? '级联成功' : (response.error || resultData?.msg || '级联失败')
      }));
      
      successDevices = defaultResults.filter(item => item.success);
      failedDevices = defaultResults.filter(item => !item.success);
      
    }
    
    // 添加获取设备信息失败的设备到结果中
    const deviceInfoFailedDevices = failedDeviceCodes.map(code => ({
      deviceCode: code,
      regionId: '',
      regionName: '',
      deviceName: '',
      success: false,
      message: '设备码错误'
    }));
    
    // 将获取设备信息失败的设备添加到级联结果中
    cascadeResults.push(...deviceInfoFailedDevices);
    
    // 重新分类成功和失败的设备
    successDevices = cascadeResults.filter(item => item.success);
    failedDevices = cascadeResults.filter(item => !item.success);
    
    // 计算统计信息
    const totalCount = cascadeResults.length;
    const successCount = successDevices.length;
    const failedCount = failedDevices.length;
    
    
    // 显示状态信息
    if (successCount === totalCount) {
      showStatus(`级联完成，全部${successCount}台设备级联成功！`, false);
    } else if (successCount > 0) {
      showStatus(`级联完成，${successCount}台成功，${failedCount}台失败`, true);
    } else {
      showStatus(`级联失败，全部${totalCount}台设备级联失败`, true);
    }
    
    // 生成表格形式的报告内容
    let reportContent = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
        <div style="display: flex; align-items: center; gap: 12px;">
          <strong style="font-size: 11px; color: #1e293b; font-weight: 700; letter-spacing: -0.3px;">级联任务结果 (共${totalCount}台):</strong>
          <div style="display: flex; gap: 16px; font-size: 11px; font-weight: 600;">
            <div style="color: #137333;">成功: ${successCount}台</div>
            <div style="color: #c5221f;">失败: ${failedCount}台</div>
          </div>
        </div>
        <button id="exportCascadeBtn" style="background: linear-gradient(135deg, #3b82f6 0%, #60a5fa 100%); color: white; border: none; padding: 8px 14px; border-radius: 10px; cursor: pointer; font-size: 10px; font-weight: 700; box-shadow: 0 4px 12px rgba(59, 130, 246, 0.25); letter-spacing: -0.2px; backdrop-filter: blur(10px); border: 1px solid rgba(255, 255, 255, 0.3); transition: all 0.25s ease;">📥 导出清单</button>
      </div>
      <div style="overflow-x: auto;">
        <table class="data-table" style="margin-top: 8px; width: 100%; border-collapse: collapse; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08); background: rgba(255, 255, 255, 0.8); backdrop-filter: blur(10px); border: 1px solid rgba(226, 232, 240, 0.5);">
          <tr style="background: linear-gradient(135deg, rgba(248, 250, 252, 0.9) 0%, rgba(241, 245, 249, 0.9) 100%); border-bottom: 1px solid rgba(226, 232, 240, 0.5); backdrop-filter: blur(10px);">
            <th style="padding: 12px 14px; text-align: left; border: 1px solid rgba(226, 232, 240, 0.5); font-weight: 700; font-size: 9px; color: #1e293b; letter-spacing: -0.2px; text-transform: uppercase; width: 40px;">序号</th>
            <th style="padding: 12px 14px; text-align: left; border: 1px solid rgba(226, 232, 240, 0.5); font-weight: 700; font-size: 9px; color: #1e293b; letter-spacing: -0.2px; text-transform: uppercase;">设备UID</th>
            <th style="padding: 12px 14px; text-align: left; border: 1px solid rgba(226, 232, 240, 0.5); font-weight: 700; font-size: 9px; color: #1e293b; letter-spacing: -0.2px; text-transform: uppercase; max-width: 120px;">设备名字</th>
            <th style="padding: 12px 14px; text-align: left; border: 1px solid rgba(226, 232, 240, 0.5); font-weight: 700; font-size: 9px; color: #1e293b; letter-spacing: -0.2px; text-transform: uppercase;">级联状态</th>
            <th style="padding: 12px 14px; text-align: left; border: 1px solid rgba(226, 232, 240, 0.5); font-weight: 700; font-size: 9px; color: #1e293b; letter-spacing: -0.2px; text-transform: uppercase;">状态信息</th>
          </tr>
          ${cascadeResults.map((item, index) => `
            <tr style="border-bottom: 1px solid rgba(226, 232, 240, 0.5); transition: all 0.2s ease; font-size: 10px; background: ${item.success ? 'rgba(16, 185, 129, 0.05)' : 'rgba(239, 68, 68, 0.05)'}" onmouseover="this.style.background='rgba(99, 102, 241, 0.05)'" onmouseout="this.style.background='${item.success ? 'rgba(16, 185, 129, 0.05)' : 'rgba(239, 68, 68, 0.05)'}">
              <td style="padding: 12px 14px; border: 1px solid rgba(226, 232, 240, 0.5); color: #475569; font-weight: 500; text-align: center; width: 40px;">${index + 1}</td>
              <td style="padding: 12px 14px; border: 1px solid rgba(226, 232, 240, 0.5); color: #475569; font-family: 'SF Mono', monospace; font-size: 9px;">${item.deviceCode || '-'}</td>
              <td style="padding: 12px 14px; border: 1px solid rgba(226, 232, 240, 0.5); color: #1e293b; font-weight: 600; font-size: 10px; max-width: 120px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${item.deviceName || '-'}</td>
              <td style="padding: 12px 14px; border: 1px solid rgba(226, 232, 240, 0.5); color: ${item.success ? '#137333' : '#c5221f'}; font-weight: 600;">
                ${item.success ? '成功' : '失败'}
              </td>
              <td style="padding: 12px 14px; border: 1px solid rgba(226, 232, 240, 0.5); color: #475569; font-size: 10px;">${item.message || (item.success ? '级联成功' : '级联失败')}</td>
            </tr>
          `).join('')}
        </table>
      </div>
    `;
    
    // 显示报告
    document.getElementById('cascadeTask').innerHTML = reportContent;
    document.getElementById('cascadeTaskResult').style.display = 'block';
    
    // 添加导出按钮事件监听器
    const exportBtn = document.getElementById('exportCascadeBtn');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => {
        exportCascadeResult(cascadeResults);
      });
    }
    
    // 隐藏进度条
    if (progressContainer) {
      progressContainer.style.display = 'none';
    }
    // 移除进度更新监听器
    chrome.runtime.onMessage.removeListener(progressUpdateListener);
  } catch (err) {
    console.error('创建级联任务失败:', err);
    showStatus('创建级联任务失败: ' + err.message, true);
    // 隐藏进度条
    const progressContainer = document.getElementById('progressContainer');
    if (progressContainer) {
      progressContainer.style.display = 'none';
    }
    // 移除进度更新监听器
    chrome.runtime.onMessage.removeListener((message) => {
      if (message.action === 'cascadeProgress') {
        return true;
      }
    });
  }
}

document.getElementById('refreshBtn').addEventListener('click', async () => {
  await fetchData();
  await autoFillUserId();
});
document.getElementById('getCustomListBtn')?.addEventListener('click', getCustomList);
document.getElementById('getLevelCusRegionBtn')?.addEventListener('click', getLevelCusRegion);
document.getElementById('queryBtn').addEventListener('click', getCustomList);
document.getElementById('createCascadeTaskBtn').addEventListener('click', createCascadeTask);
document.getElementById('queryDeviceStatusBtn').addEventListener('click', queryDeviceStatus);
document.getElementById('clearCascadeDataBtn').addEventListener('click', clearCascadeData);
document.getElementById('clearQueryDataBtn').addEventListener('click', clearQueryData);

// 批量设备查询 - 设备编码输入监听
document.getElementById('deviceCodesQuery').addEventListener('input', function() {
  const deviceCodes = this.value.trim();
  const hasInput = deviceCodes.length > 0;
  
  // 隐藏或显示文件上传相关元素
  document.getElementById('uploadFileLabelQuery').style.display = hasInput ? 'none' : 'block';
  document.getElementById('dropZoneQuery').style.display = hasInput ? 'none' : 'block';
  document.getElementById('downloadTemplateQuery').style.display = hasInput ? 'none' : 'inline';
  document.getElementById('uploadStatsQuery').style.display = hasInput ? 'none' : 'block';
});

document.getElementById('queryCustomListBtn').addEventListener('click', queryCustomListForDeviceList);
document.getElementById('queryDeviceListBtn').addEventListener('click', queryDeviceList);
document.getElementById('clearDeviceListBtn').addEventListener('click', clearDeviceListData);

// 添加根目录按钮
document.getElementById('addRootRegionBtn').addEventListener('click', async function() {
  const account = document.getElementById('regionAdjustAccount').value.trim();
  if (!account) {
    showStatus('请先输入账号', true);
    return;
  }
  
  // 从企业主信息中获取entUserId
  const entUserId = currentEntUserId;
  if (!entUserId) {
    showStatus('请先获取企业主信息', true);
    return;
  }
  
  // 弹出输入框让用户输入目录名称
  const cusRegionNames = prompt('请输入根目录名称:', '测试');
  if (!cusRegionNames || cusRegionNames.trim() === '') {
    showStatus('目录名称不能为空', true);
    return;
  }
  
  try {
    const response = await sendVcpMessage('saveRegion', {
      cusRegionNames: cusRegionNames.trim(),
      cusRegionId: '',
      entUserId: entUserId,
      isEdit: false
    });
    if (!response) return;
    
    if (response.success) {
      showStatus('添加根目录成功', false);
      document.getElementById('queryRegionAdjustBtn').click();
    } else {
      showStatus('添加根目录失败: ' + response.error, true);
    }
  } catch (err) {
    console.error('添加根目录失败:', err);
    showStatus('添加根目录失败: ' + err.message, true);
  }
});

// 停止查询按钮
if (document.getElementById('stopQueryBtn')) {
  document.getElementById('stopQueryBtn').addEventListener('click', function() {
    shouldStopQuery = true;
    showStatus('正在停止查询...', false);
    updateProgress(0, '正在停止查询...');
  });
}

// 拖放上传功能
setupDropZone({
  dropZoneId: 'dropZone',
  fileInputId: 'excelFile',
  processFn: processCSVFile
});

// 下载模板
const downloadTemplateBtn = document.getElementById('downloadTemplate');
if (downloadTemplateBtn) {
  downloadTemplateBtn.addEventListener('click', (e) => {
    e.preventDefault();
    try {
      downloadCSVTemplate();
    } catch (err) {
      console.error('下载模板失败:', err);
      showStatus('下载模板失败: ' + err.message, true);
    }
  });
}

// 批量设备查询页面的拖放上传功能
setupDropZone({
  dropZoneId: 'dropZoneQuery',
  fileInputId: 'excelFileQuery',
  processFn: processCSVFileQuery
});

const downloadTemplateBtnQuery = document.getElementById('downloadTemplateQuery');
if (downloadTemplateBtnQuery) {
  downloadTemplateBtnQuery.addEventListener('click', (e) => {
    e.preventDefault();
    try {
      downloadCSVTemplate();
    } catch (err) {
      console.error('下载模板失败:', err);
      showStatus('下载模板失败: ' + err.message, true);
    }
  });
}

function downloadCSVTemplate() {
  // 创建CSV格式的模板数据
  const csvContent = `设备编码
51111110441324005448
51111110441324005441
51111110441324005441`;
  
  // 创建Blob并下载
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = '设备编码模板.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  
  showStatus('模板下载成功');
}

function exportCascadeResult(allDevices) {
  const headers = '序号,设备UID,设备名字,级联状态,状态信息';
  const rows = (allDevices || []).map((item, index) =>
    `${index + 1},${item.deviceCode || '-'},${item.deviceName || '-'},${item.success ? '成功' : '失败'},"${item.message || (item.success ? '级联成功' : '级联失败')}"`
  );
  exportToCSV('级联结果', headers, rows);
}

// 批量设备查询相关函数
async function processCSVFileQuery(file) {
  await processCSVFileCommon(file, {
    deviceCodesId: 'deviceCodesQuery',
    dropZoneId: 'dropZoneQuery',
    uploadStatsId: 'uploadStatsQuery',
    uploadStatsContentId: 'uploadStatsContentQuery',
    excelFileId: 'excelFileQuery',
    reuploadBtnId: 'reuploadBtnQuery'
  });
}

let deviceStatusQueryAbortController = null;

async function queryDeviceStatus() {
  try {
    const tab = await ensureVcpTab();
    if (!tab) return;
    
    const deviceCodesInput = document.getElementById('deviceCodesQuery').value.trim();
    const excelFile = document.getElementById('excelFileQuery').files[0];
    
    let deviceCodeArray = [];
    
    if (excelFile) {
      try {
        const result = await readCSVFile(excelFile);
        deviceCodeArray = result.deviceCodes;
        showStatus(`使用已上传的CSV文件 - 有效: ${result.validCount}条`);
      } catch (err) {
        console.error('读取CSV文件失败:', err);
        showStatus('读取CSV文件失败: ' + err.message, true);
        return;
      }
    } else if (deviceCodesInput) {
      deviceCodeArray = deviceCodesInput.split(/\n|\r\n/).map(code => code.trim()).filter(code => code);
      const uploadFileGroup = document.getElementById('dropZoneQuery').closest('.input-group');
      if (uploadFileGroup) uploadFileGroup.style.display = 'none';
    } else {
      showStatus('请输入设备编码或上传Excel文件', true);
      return;
    }
    
    if (deviceCodeArray.length === 0) {
      showStatus('设备编码列表为空', true);
      return;
    }
    
    // 显示进度条
    const progressContainer = document.getElementById('deviceStatusProgress');
    const progressFill = document.getElementById('deviceStatusProgressFill');
    const progressPercent = document.getElementById('deviceStatusProgressPercent');
    const progressText = document.getElementById('deviceStatusProgressText');
    const stopBtn = document.getElementById('stopDeviceStatusQueryBtn');
    
    progressContainer.classList.remove('hidden');
    progressFill.style.width = '0%';
    progressPercent.textContent = '0%';
    progressText.textContent = '正在初始化...';
    stopBtn.style.display = 'inline-block';
    
    // 创建中止控制器
    deviceStatusQueryAbortController = new AbortController();
    
    // 停止按钮事件
    stopBtn.onclick = () => {
      if (deviceStatusQueryAbortController) {
        deviceStatusQueryAbortController.abort();
        showStatus('查询已停止', true);
        progressContainer.classList.add('hidden');
        stopBtn.style.display = 'none';
      }
    };
    
    
    // 监听进度更新
    const progressUpdateListener = (message) => {
      if (message.action === 'deviceStatusProgress') {
        const { progress, current, total, deviceCode } = message;
        progressFill.style.width = `${progress}%`;
        progressPercent.textContent = `${progress}%`;
        progressText.textContent = `正在查询设备 ${current}/${total}: ${deviceCode}`;
      }
    };
    
    chrome.runtime.onMessage.addListener(progressUpdateListener);
    
    try {
      const response = await chrome.tabs.sendMessage(tab.id, {
        action: 'getDeviceOnlineStatus',
        deviceCodes: deviceCodeArray
      });
      
      
      if (!response.success) {
        showStatus('查询设备在线状态失败: ' + response.error, true);
        return;
      }
      
      const deviceStatusList = response.deviceStatusList || [];
      
      // 计算在线和离线设备数量
      const onlineCount = deviceStatusList.filter(item => item.online).length;
      const offlineCount = deviceStatusList.filter(item => !item.online).length;
      
      // 显示查询结果
      const resultHtml = deviceStatusList.length > 0 ? `
        <div style="margin-bottom: 14px; padding: 16px; background: rgba(255, 255, 255, 0.7); border-radius: 16px; box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08); backdrop-filter: blur(20px); border: 1px solid rgba(255, 255, 255, 0.5); transition: all 0.3s ease;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
            <div style="display: flex; align-items: center; gap: 12px;">
              <strong style="font-size: 11px; color: #1e293b; font-weight: 700; letter-spacing: -0.3px;">设备在线状态查询结果 (共${deviceStatusList.length}台):</strong>
              <div style="display: flex; gap: 16px; font-size: 11px; font-weight: 600;">
                <div style="color: #137333;">在线: ${onlineCount}台</div>
                <div style="color: #c5221f;">离线: ${offlineCount}台</div>
              </div>
            </div>
            <button id="exportDeviceStatusBtn" style="background: linear-gradient(135deg, #3b82f6 0%, #60a5fa 100%); color: white; border: none; padding: 8px 14px; border-radius: 10px; cursor: pointer; font-size: 10px; font-weight: 700; box-shadow: 0 4px 12px rgba(59, 130, 246, 0.25); letter-spacing: -0.2px; backdrop-filter: blur(10px); border: 1px solid rgba(255, 255, 255, 0.3); transition: all 0.25s ease;">📥 导出清单</button>
          </div>
          <div style="overflow-x: auto;">
            <table class="data-table" style="margin-top: 8px; width: 100%; border-collapse: collapse; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08); background: rgba(255, 255, 255, 0.8); backdrop-filter: blur(10px); border: 1px solid rgba(226, 232, 240, 0.5);">
              <tr style="background: linear-gradient(135deg, rgba(248, 250, 252, 0.9) 0%, rgba(241, 245, 249, 0.9) 100%); border-bottom: 1px solid rgba(226, 232, 240, 0.5); backdrop-filter: blur(10px);">
                <th style="padding: 12px 14px; text-align: left; border: 1px solid rgba(226, 232, 240, 0.5); font-weight: 700; font-size: 9px; color: #1e293b; letter-spacing: -0.2px; text-transform: uppercase; width: 40px;">序号</th>
                <th style="padding: 12px 14px; text-align: left; border: 1px solid rgba(226, 232, 240, 0.5); font-weight: 700; font-size: 9px; color: #1e293b; letter-spacing: -0.2px; text-transform: uppercase;">设备UID</th>
                <th style="padding: 12px 14px; text-align: left; border: 1px solid rgba(226, 232, 240, 0.5); font-weight: 700; font-size: 9px; color: #1e293b; letter-spacing: -0.2px; text-transform: uppercase; max-width: 120px;">设备名字</th>
                <th style="padding: 12px 14px; text-align: left; border: 1px solid rgba(226, 232, 240, 0.5); font-weight: 700; font-size: 9px; color: #1e293b; letter-spacing: -0.2px; text-transform: uppercase;">在线状态</th>
                <th style="padding: 12px 14px; text-align: left; border: 1px solid rgba(226, 232, 240, 0.5); font-weight: 700; font-size: 9px; color: #1e293b; letter-spacing: -0.2px; text-transform: uppercase;">状态信息</th>
              </tr>
              ${deviceStatusList.map((item, index) => `
                <tr style="border-bottom: 1px solid rgba(226, 232, 240, 0.5); transition: all 0.2s ease; font-size: 10px; background: ${item.online ? 'rgba(16, 185, 129, 0.05)' : 'rgba(239, 68, 68, 0.05)'}" onmouseover="this.style.background='rgba(59, 130, 246, 0.05)'" onmouseout="this.style.background='${item.online ? 'rgba(16, 185, 129, 0.05)' : 'rgba(239, 68, 68, 0.05)'}">
                  <td style="padding: 12px 14px; border: 1px solid rgba(226, 232, 240, 0.5); color: #475569; font-weight: 500; text-align: center; width: 40px;">${index + 1}</td>
                  <td style="padding: 12px 14px; border: 1px solid rgba(226, 232, 240, 0.5); color: #475569; font-family: 'SF Mono', monospace; font-size: 9px;">${item.deviceCode || '-'}</td>
                  <td style="padding: 12px 14px; border: 1px solid rgba(226, 232, 240, 0.5); color: #1e293b; font-weight: 600; font-size: 10px; max-width: 120px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${item.deviceName || '-'}</td>
                  <td style="padding: 12px 14px; border: 1px solid rgba(226, 232, 240, 0.5); color: ${item.online ? '#137333' : '#c5221f'}; font-weight: 600;">
                    ${item.online ? '在线' : '离线'}
                  </td>
                  <td style="padding: 12px 14px; border: 1px solid rgba(226, 232, 240, 0.5); color: #475569; font-size: 10px;">${item.message || (item.online ? '设备在线' : '设备离线')}</td>
                </tr>
              `).join('')}
            </table>
          </div>
        </div>
      ` : '<div class="no-data">没有设备信息</div>';

      
      document.getElementById('deviceStatusResult').style.display = 'block';
      document.getElementById('deviceStatus').innerHTML = resultHtml;
      
      // 添加导出按钮事件监听器
      const exportBtn = document.getElementById('exportDeviceStatusBtn');
      if (exportBtn) {
        exportBtn.addEventListener('click', () => {
          exportDeviceStatusResult(deviceStatusList);
        });
      }
      
      showStatus('设备在线状态查询成功');
    } catch (err) {
      if (err.name === 'AbortError') {
        return;
      }
      throw err;
    } finally {
      // 隐藏进度条
      progressContainer.classList.add('hidden');
      stopBtn.style.display = 'none';
      // 移除进度更新监听器
      chrome.runtime.onMessage.removeListener(progressUpdateListener);
      // 清理中止控制器
      deviceStatusQueryAbortController = null;
    }
  } catch (err) {
    console.error('查询设备在线状态失败:', err);
    showStatus('查询设备在线状态失败: ' + err.message, true);
    // 隐藏进度条
    const progressContainer = document.getElementById('deviceStatusProgress');
    const stopBtn = document.getElementById('stopDeviceStatusQueryBtn');
    if (progressContainer) {
      progressContainer.classList.add('hidden');
    }
    if (stopBtn) {
      stopBtn.style.display = 'none';
    }
    // 清理中止控制器
    deviceStatusQueryAbortController = null;
  }
}

function exportDeviceStatusResult(deviceStatusList) {
  if (!deviceStatusList || deviceStatusList.length === 0) {
    showStatus('没有可导出的数据', true);
    return;
  }
  
  // 创建CSV格式的导出数据
  const csvContent = `序号,设备UID,设备名字,在线状态,状态信息
${deviceStatusList.map((item, index) => 
  `${index + 1},${item.deviceCode || '-'},${item.deviceName || '-'},${item.online ? '在线' : '离线'},"${item.message || (item.online ? '设备在线' : '设备离线')}"`
).join('\n')}`;
  
  // 创建Blob并下载
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  
  // 生成带时间戳的文件名
  const now = new Date();
  const timestamp = now.toISOString().slice(0, 10).replace(/-/g, '') + 
                   now.toTimeString().slice(0, 8).replace(/:/g, '');
  a.download = `设备在线状态_${timestamp}.csv`;
  
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  
  showStatus('设备在线状态导出成功');
}

document.querySelectorAll('.copy-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const targetId = btn.getAttribute('data-target');
    const content = document.getElementById(targetId).textContent;
    if (content && content !== '-' && content !== '(未找到 safeVillageCookie)') {
      copyToClipboard(content);
    } else {
      showStatus('没有可复制的内容', true);
    }
  });
});

// 清除级联功能页面数据
function clearCascadeData() {
  
  // 清除输入框
  document.getElementById('enteraccount').value = '';
  document.getElementById('deviceCodes').value = '';
  
  // 清除文件输入
  const excelFile = document.getElementById('excelFile');
  if (excelFile) {
    excelFile.value = '';
  }
  
  // 显示上传控件
  const deviceCodesGroup = document.getElementById('deviceCodes').closest('.input-group');
  const uploadFileGroup = document.getElementById('dropZone').closest('.input-group');
  if (deviceCodesGroup) {
    deviceCodesGroup.style.display = 'block';
  }
  if (uploadFileGroup) {
    uploadFileGroup.style.display = 'block';
  }
  
  // 隐藏结果区域
  document.getElementById('regionResult').style.display = 'none';
  document.getElementById('customListResult').style.display = 'none';
  document.getElementById('levelCusRegionResult').style.display = 'none';
  document.getElementById('uploadStats').style.display = 'none';
  document.getElementById('cascadeTaskResult').style.display = 'none';
  
  // 清空结果内容
  document.getElementById('regionCode').textContent = '-';
  document.getElementById('customList').textContent = '-';
  document.getElementById('levelCusRegion').textContent = '-';
  document.getElementById('uploadStatsContent').textContent = '-';
  document.getElementById('cascadeTask').textContent = '-';
  
  // 清除状态信息
  const status = document.getElementById('status');
  status.style.display = 'none';
  
  showStatus('级联功能页面数据已清除', false);
}

// 清除设备查询页面数据
function clearQueryData() {
  
  // 清除输入框
  document.getElementById('deviceCodesQuery').value = '';
  
  // 清除文件输入
  const excelFileQuery = document.getElementById('excelFileQuery');
  if (excelFileQuery) {
    excelFileQuery.value = '';
  }
  
  // 显示上传控件
  const deviceCodesGroup = document.getElementById('deviceCodesQuery').closest('.input-group');
  const uploadFileGroup = document.getElementById('dropZoneQuery').closest('.input-group');
  if (deviceCodesGroup) {
    deviceCodesGroup.style.display = 'block';
  }
  if (uploadFileGroup) {
    uploadFileGroup.style.display = 'block';
  }
  
  // 显示文件上传相关元素
  document.getElementById('uploadFileLabelQuery').style.display = 'block';
  document.getElementById('dropZoneQuery').style.display = 'block';
  document.getElementById('downloadTemplateQuery').style.display = 'inline';
  document.getElementById('uploadStatsQuery').style.display = 'block';
  
  // 隐藏结果区域
  document.getElementById('deviceStatusResult').classList.add('hidden');
  
  // 清空结果内容
  document.getElementById('uploadStatsContentQuery').textContent = '-';
  document.getElementById('deviceStatus').textContent = '-';
  
  // 清除状态信息
  const status = document.getElementById('status');
  status.style.display = 'none';
  
  showStatus('设备查询页面数据已清除', false);
}

// 画质监测功能
async function queryQuality() {
  try {
    const tab = await ensureVcpTab();
    if (!tab) return;
    
    const deviceCode = document.getElementById('deviceCodeQuality').value.trim();
    
    if (!deviceCode) {
      showStatus('请输入设备编码', true);
      return;
    }
    
    const progressContainer = document.getElementById('qualityProgress');
    const progressFill = document.getElementById('qualityProgressFill');
    const progressPercent = document.getElementById('qualityProgressPercent');
    const progressText = document.getElementById('qualityProgressText');
    
    progressContainer.classList.remove('hidden');
    progressFill.style.width = '0%';
    progressPercent.textContent = '0%';
    progressText.textContent = '正在初始化...';
    
    try {
      const response = await sendVcpMessage('getDeviceScreenShot', { deviceCode });
      if (!response) return;
      
      if (!response.success) {
        showStatus('查询设备画质失败: ' + response.error, true);
        document.getElementById('qualityResult').style.display = 'block';
        document.getElementById('qualityImage').style.display = 'none';
        document.getElementById('qualityError').style.display = 'block';
        document.getElementById('qualityError').textContent = response.error || '查询失败';
        return;
      }
      
      const imageUrl = response.imageUrl;
      
      document.getElementById('qualityResult').style.display = 'block';
      document.getElementById('qualityImage').style.display = 'block';
      document.getElementById('qualityError').style.display = 'none';
      document.getElementById('qualityImage').src = imageUrl;
      
      document.getElementById('qualityImage').onclick = function() {
        const modal = document.getElementById('imageModal');
        const modalImage = document.getElementById('modalImage');
        modalImage.src = imageUrl;
        modal.style.display = 'flex';
      };
      
      showStatus('设备画质查询成功');
    } catch (err) {
      console.error('查询设备画质失败:', err);
      showStatus('查询设备画质失败: ' + err.message, true);
      // 显示错误信息
      document.getElementById('qualityResult').style.display = 'block';
      document.getElementById('qualityImage').style.display = 'none';
      document.getElementById('qualityError').style.display = 'block';
      document.getElementById('qualityError').textContent = err.message || '查询失败';
    } finally {
      // 隐藏进度条
      progressContainer.classList.add('hidden');
    }
  } catch (err) {
    console.error('查询设备画质失败:', err);
    showStatus('查询设备画质失败: ' + err.message, true);
    // 隐藏进度条
    const progressContainer = document.getElementById('qualityProgress');
    if (progressContainer) {
      progressContainer.classList.add('hidden');
    }
  }
}

// 清除画质监测页面数据
function clearQualityData() {
  
  // 清除输入框
  document.getElementById('deviceCodeQuality').value = '';
  
  // 隐藏结果区域
  document.getElementById('qualityResult').style.display = 'none';
  
  // 清空结果内容
  document.getElementById('qualityImage').src = '';
  document.getElementById('qualityError').textContent = '';
  
  // 清除状态信息
  const status = document.getElementById('status');
  status.style.display = 'none';
  
  showStatus('画质监测页面数据已清除', false);
}

// 设备清单查询相关函数
async function queryCustomListForDeviceList() {
  const userId = currentUserId;
  const account = document.getElementById('deviceListAccount').value.trim();
  
  if (!validatePhoneAccount(userId, account)) return;
  
  try {
    const response = await sendVcpMessage('getCustomList', { userId, account });
    if (!response) return;
    
    if (response.success) {
      const customData = response.data;
      
      if (customData && customData.data && customData.data.list) {
        const list = customData.data.list;
        
        if (list.length > 0) {
          const customListHtml = `
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; padding: 8px;">
              ${list.map((item, index) => `
                <div style="padding: 6px; border: 1.5px solid #e2e8f0; border-radius: 8px; background: rgba(255, 255, 255, 0.9); cursor: pointer; transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1); backdrop-filter: blur(10px); min-height: 60px; display: flex; flex-direction: column; justify-content: space-between;">
                  <div style="display: flex; align-items: center; gap: 4px; margin-bottom: 4px;">
                    <input type="radio" name="custom-radio" class="custom-radio" data-id="${item.id}" data-name="${item.name || ''}" data-role="${item.roleName || ''}" style="width: 12px; height: 12px; accent-color: #6366f1;">
                    <span style="font-size: 10px; font-weight: 700; color: #1e293b; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; letter-spacing: -0.2px;">${item.name || '未命名'}</span>
                  </div>
                  <div style="font-size: 9px; color: #64748b; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 500;">角色: ${item.roleName || '-'}</div>
                  <div style="font-size: 8px; color: #94a3b8; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 500;">ID: ${item.id}</div>
                </div>
              `).join('')}
            </div>
          `;
          
          document.getElementById('customListResultDeviceList').style.display = 'block';
          document.getElementById('customListDeviceList').innerHTML = customListHtml;
          
          showStatus(`查询到 ${list.length} 个用户`, false);
          
          // 添加单选按钮事件监听
          document.querySelectorAll('.custom-radio').forEach(radio => {
            radio.addEventListener('change', () => {
            });
          });
        } else {
          document.getElementById('customListResultDeviceList').style.display = 'block';
          document.getElementById('customListDeviceList').textContent = '未查询到用户';
          showStatus('未查询到用户', true);
        }
      } else {
        document.getElementById('customListResultDeviceList').style.display = 'block';
        document.getElementById('customListDeviceList').textContent = '未获取到数据';
        showStatus('获取客户列表失败', true);
      }
    } else {
      showStatus('获取客户列表失败: ' + response.error, true);
    }
  } catch (err) {
    console.error('获取客户列表失败:', err);
    showStatus('获取客户列表失败: ' + err.message, true);
  }
}

async function queryDeviceList() {
  
  const selectedRadio = document.querySelector('.custom-radio:checked');
  if (!selectedRadio) {
    showStatus('请先选择企业主', true);
    return;
  }
  
  const userId = selectedRadio.getAttribute('data-id');
  
  try {
    const tab = await ensureVcpTab();
    if (!tab) return;
    
    shouldStopQuery = false;
    
    document.getElementById('deviceListProgress').classList.remove('hidden');
    document.getElementById('stopQueryBtn').style.display = 'inline-block';
    updateProgress(0, '正在初始化...');
    
    let allDevices = [];
    let pageNo = 1;
    const pageSize = 10;
    let hasMore = true;
    let totalCount = 0;
    
    showStatus('开始获取设备清单，正在处理...', false);
    
    while (hasMore && !shouldStopQuery) {
      if (shouldStopQuery) {
        showStatus('查询已停止', false);
        document.getElementById('deviceListProgress').classList.add('hidden');
        document.getElementById('stopQueryBtn').style.display = 'none';
        return;
      }
      
      const response = await chrome.tabs.sendMessage(tab.id, {
        action: 'getEnterpriseUserDeviceList',
        userId: userId,
        pageNo: pageNo,
        pageSize: pageSize
      });
      
      if (!response.success) {
        showStatus('获取设备清单失败: ' + response.error, true);
        document.getElementById('deviceListProgress').classList.add('hidden');
        document.getElementById('stopQueryBtn').style.display = 'none';
        return;
      }
      
      const deviceData = response.data;
      if (deviceData && deviceData.data && deviceData.data.deviceList) {
        const deviceList = deviceData.data.deviceList;
        allDevices = [...allDevices, ...deviceList];
        
        if (totalCount === 0) {
          totalCount = deviceData.data.total || 0;
        }
        
        // 更新进度条
        const progress = totalCount > 0 ? Math.min((allDevices.length / totalCount) * 100, 100) : 0;
        updateProgress(progress, `正在获取第 ${pageNo} 页数据... (已获取 ${allDevices.length}/${totalCount} 台设备)`);
        
        // 检查是否还有更多数据
        if (allDevices.length >= totalCount || deviceList.length === 0) {
          hasMore = false;
        } else {
          pageNo++;
        }
      } else {
        hasMore = false;
      }
    }
    
    // 检查是否是用户停止
    if (shouldStopQuery) {
      showStatus('查询已停止', false);
      document.getElementById('deviceListProgress').classList.add('hidden');
      document.getElementById('stopQueryBtn').style.display = 'none';
      return;
    }
    
    // 完成进度
    updateProgress(100, `查询完成！共获取 ${allDevices.length} 台设备`);
    
    
    // 隐藏进度条和停止按钮
    setTimeout(() => {
      document.getElementById('deviceListProgress').classList.add('hidden');
      document.getElementById('stopQueryBtn').style.display = 'none';
    }, 2000);
    
    // 显示设备清单
    if (allDevices.length > 0) {
      const resultHtml = `
        <div style="padding: 16px; background: rgba(255, 255, 255, 0.7); border-radius: 16px; box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08); backdrop-filter: blur(20px); border: 1px solid rgba(255, 255, 255, 0.5); transition: all 0.3s ease;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
            <strong style="font-size: 11px; color: #1e293b; font-weight: 700; letter-spacing: -0.3px;">设备清单 (共${allDevices.length}台):</strong>
            <button id="exportDeviceListBtn" style="background: linear-gradient(135deg, #3b82f6 0%, #60a5fa 100%); color: white; border: none; padding: 8px 14px; border-radius: 10px; cursor: pointer; font-size: 10px; font-weight: 700; box-shadow: 0 4px 12px rgba(59, 130, 246, 0.25); letter-spacing: -0.2px; backdrop-filter: blur(10px); border: 1px solid rgba(255, 255, 255, 0.3); transition: all 0.25s ease;">📥 导出清单</button>
          </div>
          <div style="overflow-x: auto;">
            <table class="data-table" style="margin-top: 8px; width: 100%; border-collapse: collapse; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08); background: rgba(255, 255, 255, 0.8); backdrop-filter: blur(10px); border: 1px solid rgba(226, 232, 240, 0.5);">
              <tr style="background: linear-gradient(135deg, rgba(248, 250, 252, 0.9) 0%, rgba(241, 245, 249, 0.9) 100%); border-bottom: 1px solid rgba(226, 232, 240, 0.5); backdrop-filter: blur(10px);">
                <th style="padding: 12px 14px; text-align: left; border: 1px solid rgba(226, 232, 240, 0.5); font-weight: 700; font-size: 9px; color: #1e293b; letter-spacing: -0.2px; text-transform: uppercase; width: 40px;">序号</th>
                <th style="padding: 12px 14px; text-align: left; border: 1px solid rgba(226, 232, 240, 0.5); font-weight: 700; font-size: 9px; color: #1e293b; letter-spacing: -0.2px; text-transform: uppercase; max-width: 120px;">设备名称</th>
                <th style="padding: 12px 14px; text-align: left; border: 1px solid rgba(226, 232, 240, 0.5); font-weight: 700; font-size: 9px; color: #1e293b; letter-spacing: -0.2px; text-transform: uppercase;">设备编码</th>
                <th style="padding: 12px 14px; text-align: left; border: 1px solid rgba(226, 232, 240, 0.5); font-weight: 700; font-size: 9px; color: #1e293b; letter-spacing: -0.2px; text-transform: uppercase;">设备型号</th>
                <th style="padding: 12px 14px; text-align: left; border: 1px solid rgba(226, 232, 240, 0.5); font-weight: 700; font-size: 9px; color: #1e293b; letter-spacing: -0.2px; text-transform: uppercase;">目录</th>
              </tr>
              ${allDevices.map((item, index) => `
                <tr style="border-bottom: 1px solid rgba(226, 232, 240, 0.5); transition: all 0.2s ease; font-size: 10px;" onmouseover="this.style.background='rgba(99, 102, 241, 0.05)'" onmouseout="this.style.background='transparent'">
                  <td style="padding: 12px 14px; border: 1px solid rgba(226, 232, 240, 0.5); color: #475569; font-weight: 500; text-align: center; width: 40px;">${index + 1}</td>
                  <td style="padding: 12px 14px; border: 1px solid rgba(226, 232, 240, 0.5); color: #1e293b; font-weight: 600; font-size: 10px; max-width: 120px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${item.deviceName || '-'}</td>
                  <td style="padding: 12px 14px; border: 1px solid rgba(226, 232, 240, 0.5); color: #475569; font-family: 'SF Mono', monospace; font-size: 9px;">${item.deviceCode || '-'}</td>
                  <td style="padding: 12px 14px; border: 1px solid rgba(226, 232, 240, 0.5); color: #475569; font-size: 10px;">${item.deviceModel || '-'}</td>
                  <td style="padding: 12px 14px; border: 1px solid rgba(226, 232, 240, 0.5); color: #475569; font-size: 10px;">${item.location || '-'}</td>
                </tr>
              `).join('')}
            </table>
          </div>
        </div>
      `;
      
      document.getElementById('deviceListResult').style.display = 'block';
      document.getElementById('deviceListContent').innerHTML = resultHtml;
      
      // 添加导出按钮事件监听器
      const exportBtn = document.getElementById('exportDeviceListBtn');
      if (exportBtn) {
        exportBtn.addEventListener('click', () => {
          exportDeviceList(allDevices);
        });
      }
      
      showStatus(`设备清单获取成功，共 ${allDevices.length} 台设备`, false);
    } else {
      document.getElementById('deviceListResult').style.display = 'block';
      document.getElementById('deviceListContent').innerHTML = '<div style="padding: 10px; text-align: center; color: #6c757d;">没有设备信息</div>';
      showStatus('未查询到设备信息', true);
    }
  } catch (err) {
    console.error('查询设备清单失败:', err);
    showStatus('查询设备清单失败: ' + err.message, true);
  }
}

function exportDeviceList(deviceList) {
  const headers = '序号,设备名称,设备编码,设备型号,位置';
  const rows = (deviceList || []).map((item, index) =>
    `${index + 1},${item.deviceName || '-'},${item.deviceCode || '-'},${item.deviceModel || '-'},${item.location || '-'}`
  );
  exportToCSV('设备清单', headers, rows);
}

function clearDeviceListData() {
  
  // 清除输入框
  document.getElementById('deviceListAccount').value = '';
  
  // 隐藏结果区域
  document.getElementById('customListResultDeviceList').style.display = 'none';
  document.getElementById('deviceListResult').style.display = 'none';
  document.getElementById('deviceListProgress').style.display = 'none';
  
  // 隐藏停止按钮
  document.getElementById('stopQueryBtn').style.display = 'none';
  
  // 重置停止标志
  shouldStopQuery = false;
  
  // 清空结果内容
  document.getElementById('customListDeviceList').textContent = '-';
  document.getElementById('deviceListContent').textContent = '-';
  
  // 重置进度条
  document.getElementById('progressFill').style.width = '0%';
  document.getElementById('progressPercent').textContent = '0%';
  document.getElementById('progressText').textContent = '正在初始化...';
  
  // 清除状态信息
  const status = document.getElementById('status');
  status.style.display = 'none';
  
  showStatus('设备清单查询页面数据已清除', false);
}

// 标签页切换功能
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const tabId = btn.getAttribute('data-tab');
    
    // 移除所有标签页的active类
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    
    // 添加当前标签页的active类
    btn.classList.add('active');
    document.getElementById(tabId).classList.add('active');
  });
});

(async () => {
  const tab = await getVcpTab();
  if (tab && tab.url && tab.url.includes('vcp.21cn.com')) {
    fetchData();
    autoFillUserId();
  }
})();

// 画质监测功能事件监听器
document.getElementById('queryQualityBtn').addEventListener('click', queryQuality);
document.getElementById('clearQualityDataBtn').addEventListener('click', clearQualityData);

document.getElementById('closeModal').addEventListener('click', () => {
  document.getElementById('imageModal').style.display = 'none';
});
document.getElementById('imageModal').addEventListener('click', (e) => {
  if (e.target === document.getElementById('imageModal')) {
    document.getElementById('imageModal').style.display = 'none';
  }
});

// 监控目录调整页面事件监听器
document.getElementById('queryRegionAdjustBtn').addEventListener('click', queryCustomListForRegionAdjust);
document.getElementById('clearRegionAdjustDataBtn').addEventListener('click', clearRegionAdjustData);
document.getElementById('exportCatalogBtn').addEventListener('click', exportCatalogCodeEmail);

// 监控目录调整页面相关函数
async function queryCustomListForRegionAdjust() {
  const userId = currentUserId;
  const account = document.getElementById('regionAdjustAccount').value.trim();
  
  if (!validatePhoneAccount(userId, account)) return;
  
  try {
    const response = await sendVcpMessage('getCustomList', { userId, account });
    if (!response) return;
    
    if (response.success) {
      const customData = response.data;
      
      if (customData && customData.data && customData.data.list) {
        const list = customData.data.list;
        const qiyezhuList = list.filter(item => item.roleName === '企业主');
        
        if (qiyezhuList.length > 0) {
          showStatus('该账户是企业主，正在获取监控目录...');
          currentEntUserId = qiyezhuList[0].id;
          await getUserRegionListForRegionAdjust(qiyezhuList[0].id);
        } else {
          document.getElementById('regionAdjustListResult').style.display = 'block';
          document.getElementById('regionAdjustList').textContent = '该账户不是企业主';
          showStatus('该账户不是企业主', true);
        }
      } else {
        document.getElementById('regionAdjustListResult').style.display = 'block';
        document.getElementById('regionAdjustList').textContent = '未获取到数据';
        showStatus('获取客户列表失败', true);
      }
    } else {
      showStatus('获取客户列表失败: ' + response.error, true);
    }
  } catch (err) {
    console.error('获取客户列表失败:', err);
    showStatus('获取客户列表失败: ' + err.message, true);
  }
}

async function getUserRegionListForRegionAdjust(userId) {
  try {
    const response = await sendVcpMessage('getUserRegionList', { userId });
    if (!response) return;
    
    if (response.success) {
      await getLevelCusRegionForRegionAdjust();
    } else {
      showStatus('获取区域代码失败: ' + response.error, true);
    }
  } catch (err) {
    console.error('获取区域代码失败:', err);
    showStatus('获取区域代码失败: ' + err.message, true);
  }
}

async function getLevelCusRegionForRegionAdjust() {
  try {
    const response = await sendVcpMessage('getLevelCusRegion');
    if (!response) return;
    
    if (response.success) {
      const regionData = response.data;
      
      if (regionData && regionData.data && regionData.data.cusRegionList) {
        const regionList = regionData.data.cusRegionList;
        const regionHtml = renderRegionTree(regionList);
        
        document.getElementById('regionAdjustListResult').style.display = 'block';
        document.getElementById('regionAdjustList').innerHTML = regionHtml;
        showStatus('获取监控目录成功');
        
        addRegionClickHandlers();
      } else {
        document.getElementById('regionAdjustListResult').style.display = 'block';
        document.getElementById('regionAdjustList').textContent = '未获取到监控目录数据';
        showStatus('获取监控目录失败', true);
      }
    } else {
      showStatus('获取监控目录失败: ' + response.error, true);
    }
  } catch (err) {
    console.error('获取监控目录失败:', err);
    showStatus('获取监控目录失败: ' + err.message, true);
  }
}

function clearRegionAdjustData() {
  
  // 清除输入框
  document.getElementById('regionAdjustAccount').value = '';
  
  // 隐藏结果区域
  document.getElementById('regionAdjustListResult').style.display = 'none';
  document.getElementById('regionAdjustForm').style.display = 'none';
  document.getElementById('regionAdjustResult').style.display = 'none';
  
  // 清空结果内容
  document.getElementById('regionAdjustList').textContent = '-';
  document.getElementById('regionAdjustName').value = '';
  document.getElementById('regionAdjustId').value = '';
  document.getElementById('regionAdjustEntUserId').value = '';
  document.getElementById('regionAdjustParentId').value = '';
  document.getElementById('regionAdjustContent').textContent = '-';
  
  // 清除状态信息
  const status = document.getElementById('status');
  status.style.display = 'none';
  
  showStatus('监控目录调整页面数据已清除', false);
}

async function exportCatalogCodeEmail() {
  if (!currentEntUserId) {
    showStatus('请先获取企业主信息', true);
    return;
  }

  const email = prompt('请输入邮箱地址:');
  if (!email || !email.trim()) {
    showStatus('邮箱地址不能为空', true);
    return;
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email.trim())) {
    showStatus('请输入有效的邮箱地址', true);
    return;
  }

  try {
    const response = await sendVcpMessage('exportCatalogCodeEmail', {
      userId: currentUserId,
      cusRegionId: '',
      email: email.trim(),
      entUserId: currentEntUserId
    });

    if (!response) return;

    if (response.success) {
      showStatus('目录导出成功，请查收邮件');
    } else {
      showStatus('目录导出失败: ' + response.error, true);
    }
  } catch (err) {
    console.error('导出目录失败:', err);
    showStatus('导出目录失败: ' + err.message, true);
  }
}





// 脱敏处理函数
function maskUserId(userId) {
  if (!userId || userId.length <= 4) {
    return userId;
  }
  const start = userId.substring(0, 2);
  const end = userId.substring(userId.length - 2);
  const middle = '*'.repeat(userId.length - 4);
  return start + middle + end;
}

// 手机号脱敏处理函数
function maskPhone(phone) {
  if (!phone || phone.length !== 11) {
    return phone;
  }
  return phone.substring(0, 3) + '****' + phone.substring(7);
}

let currentUserId = '';

// 全局变量：企业主ID（用于监控目录调整）
let currentEntUserId = '';
let currentAccount = '';
let currentCascadeServiceInfo = '';

// 汇聚功能2全局数据
let cascade2Data = null;
let cascade2GroupedData = null;

async function autoFillUserId() {
  try {
    const response = await sendVcpMessage('getUserId');
    if (!response) return;
    
    if (response.success) {
      const userId = response.userId;
      const account = response.account;
      
      currentUserId = userId;
      currentAccount = account;
      
      document.getElementById('userIdDisplay').textContent = maskUserId(userId) || '未检测到用户ID';
      document.getElementById('accountDisplay').textContent = maskPhone(account) || '未检测到手机号';
      
      showStatus('获取用户信息成功');
    } else {
      document.getElementById('userIdDisplay').textContent = '未检测到用户ID';
      document.getElementById('accountDisplay').textContent = '未检测到手机号';
    }
  } catch (err) {
    console.error('获取用户信息失败:', err);
    document.getElementById('userIdDisplay').textContent = '获取失败';
    document.getElementById('accountDisplay').textContent = '获取失败';
  }
}

// ==================== 汇聚功能2 ====================

// 读取汇聚功能2的CSV文件（包含设备编码、汇聚手机号码、目标目录三列）
async function readCascade2CSVFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const text = e.target.result;
        const lines = text.split('\n');
        const data = [];
        
        // 跳过表头，从第二行开始读取
        for (let i = 1; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue;
          
          // 解析CSV行（处理逗号分隔，支持引号包裹的字段）
          const fields = parseCSVLine(line);
          if (fields.length >= 3) {
            data.push({
              deviceCode: fields[0].trim(),
              phone: fields[1].trim(),
              targetDir: fields[2].trim()
            });
          } else if (fields.length >= 2) {
            data.push({
              deviceCode: fields[0].trim(),
              phone: fields[1].trim(),
              targetDir: ''
            });
          }
        }
        
        // 去重处理（以设备编码+手机号码为唯一键）
        const seen = new Set();
        const uniqueData = [];
        for (const item of data) {
          const key = item.deviceCode + '|' + item.phone;
          if (!seen.has(key) && item.deviceCode && item.phone) {
            seen.add(key);
            uniqueData.push(item);
          }
        }
        
        resolve({
          data: uniqueData,
          totalUpload: data.length,
          duplicateCount: data.length - uniqueData.length,
          validCount: uniqueData.length
        });
      } catch (err) {
        reject(err);
      }
    };
    
    reader.onerror = () => reject(new Error('文件读取失败'));
    reader.readAsText(file, 'UTF-8');
  });
}

// 解析CSV行
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

/**
 * 汇聚功能2 - 数据预处理：按手机号码和目标目录进行二次分组
 * 
 * 功能说明：
 * - 将CSV数据按"手机号"分组后，再按"目标目录"二次分组
 * - 支持同一手机号下的设备级联到不同的目标目录
 * 
 * 数据结构示例：
 * 输入数据：
 *   [
 *     { deviceCode: 'A', phone: '13800138000', targetDir: '测试目录' },
 *     { deviceCode: 'B', phone: '13800138000', targetDir: '生产目录' },
 *     { deviceCode: 'C', phone: '13800138000', targetDir: '测试目录' }
 *   ]
 * 
 * 输出结构：
 *   {
 *     "13800138000": {
 *       phone: "13800138000",
 *       dirGroups: {
 *         "测试目录": { targetDir: "测试目录", devices: [设备A, 设备C] },
 *         "生产目录": { targetDir: "生产目录", devices: [设备B] }
 *       }
 *     }
 *   }
 * 
 * @param {Array} data - CSV解析后的原始数据数组
 * @returns {Object} 按手机号和目录分组的对象
 */
function groupByPhoneAndDir(data) {
  const phoneGroups = {};
  
  for (const item of data) {
    const phone = item.phone;
    const targetDir = item.targetDir || '默认目录';
    
    // 第一层：按手机号分组
    if (!phoneGroups[phone]) {
      phoneGroups[phone] = {
        phone: phone,
        dirGroups: {}
      };
    }
    
    // 第二层：在同一个手机号下，再按目标目录分组
    if (!phoneGroups[phone].dirGroups[targetDir]) {
      phoneGroups[phone].dirGroups[targetDir] = {
        targetDir: targetDir,
        devices: []
      };
    }
    
    // 将设备添加到对应的（手机号+目录）组中
    phoneGroups[phone].dirGroups[targetDir].devices.push({
      deviceCode: item.deviceCode,
      targetDir: targetDir
    });
  }
  
  return phoneGroups;
}

// 处理汇聚功能2的CSV文件上传
async function processCascade2CSVFile(file) {
  try {
    const result = await readCascade2CSVFile(file);
    cascade2Data = result.data;
    cascade2GroupedData = groupByPhoneAndDir(result.data);
    
    const phoneCount = Object.keys(cascade2GroupedData).length;
    let totalDirGroups = 0;
    for (const phone in cascade2GroupedData) {
      totalDirGroups += Object.keys(cascade2GroupedData[phone].dirGroups).length;
    }
    const deviceCount = result.data.length;
    
    // 显示上传统计
    const uploadStatsHtml = `
      <div style="overflow-x: auto;">
        <table class="data-table" style="margin-top: 8px; width: 100%; border-collapse: collapse; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08); background: rgba(255, 255, 255, 0.8); backdrop-filter: blur(10px); border: 1px solid rgba(226, 232, 240, 0.5);">
          <tr style="background: linear-gradient(135deg, rgba(248, 250, 252, 0.9) 0%, rgba(241, 245, 249, 0.9) 100%); border-bottom: 1px solid rgba(226, 232, 240, 0.5); backdrop-filter: blur(10px);">
            <th style="padding: 12px 14px; text-align: left; border: 1px solid rgba(226, 232, 240, 0.5); font-weight: 700; font-size: 9px; color: #1e293b; letter-spacing: -0.2px; text-transform: uppercase;">总上传条数</th>
            <th style="padding: 12px 14px; text-align: left; border: 1px solid rgba(226, 232, 240, 0.5); font-weight: 700; font-size: 9px; color: #1e293b; letter-spacing: -0.2px; text-transform: uppercase;">重复条数</th>
            <th style="padding: 12px 14px; text-align: left; border: 1px solid rgba(226, 232, 240, 0.5); font-weight: 700; font-size: 9px; color: #1e293b; letter-spacing: -0.2px; text-transform: uppercase;">有效条数</th>
            <th style="padding: 12px 14px; text-align: left; border: 1px solid rgba(226, 232, 240, 0.5); font-weight: 700; font-size: 9px; color: #1e293b; letter-spacing: -0.2px; text-transform: uppercase;">手机号码数</th>
          </tr>
          <tr style="border-bottom: 1px solid rgba(226, 232, 240, 0.5); transition: all 0.2s ease; font-size: 10px;">
            <td style="padding: 12px 14px; border: 1px solid rgba(226, 232, 240, 0.5); color: #475569; font-weight: 500;">${result.totalUpload}</td>
            <td style="padding: 12px 14px; border: 1px solid rgba(226, 232, 240, 0.5); color: #c5221f; font-weight: 600;">${result.duplicateCount}</td>
            <td style="padding: 12px 14px; border: 1px solid rgba(226, 232, 240, 0.5); color: #137333; font-weight: 600;">${result.validCount}</td>
            <td style="padding: 12px 14px; border: 1px solid rgba(226, 232, 240, 0.5); color: #3b82f6; font-weight: 600;">${phoneCount}</td>
          </tr>
        </table>
      </div>
      <button id="reuploadBtnCascade2" style="margin-top: 12px; width: 100%; background: linear-gradient(135deg, #3b82f6 0%, #60a5fa 100%); color: white; border: none; padding: 10px; border-radius: 10px; cursor: pointer; font-size: 11px; font-weight: 700; box-shadow: 0 4px 12px rgba(59, 130, 246, 0.25); letter-spacing: -0.2px; backdrop-filter: blur(10px); border: 1px solid rgba(255, 255, 255, 0.3); transition: all 0.25s ease;">🔄 重新上传</button>
    `;
    
    document.getElementById('uploadStatsCascade2').style.display = 'block';
    document.getElementById('uploadStatsContentCascade2').innerHTML = uploadStatsHtml;
    
    // 隐藏上传区域
    const uploadFileGroup = document.getElementById('dropZoneCascade2').closest('.input-group');
    if (uploadFileGroup) uploadFileGroup.style.display = 'none';
    
    // 重新上传按钮事件
    document.getElementById('reuploadBtnCascade2').addEventListener('click', () => {
      if (uploadFileGroup) uploadFileGroup.style.display = 'block';
      document.getElementById('uploadStatsCascade2').style.display = 'none';
      document.getElementById('excelFileCascade2').value = '';
      document.getElementById('cascade2GroupResult').style.display = 'none';
      cascade2Data = null;
      cascade2GroupedData = null;
      showStatus('可以重新上传文件');
    });
    
    // 显示分组预览
    let groupHtml = '<div style="font-size: 10px;">';
    for (const [phone, phoneGroup] of Object.entries(cascade2GroupedData)) {
      const dirCount = Object.keys(phoneGroup.dirGroups).length;
      const totalDevices = Object.values(phoneGroup.dirGroups).reduce((sum, dg) => sum + dg.devices.length, 0);
      
      groupHtml += `
        <div style="margin-bottom: 10px; padding: 8px; background: rgba(59, 130, 246, 0.05); border-radius: 8px; border: 1px solid rgba(226, 232, 240, 0.5);">
          <div style="font-weight: 700; color: #1e293b; margin-bottom: 6px;">📱 ${phone} (${totalDevices}台设备, ${dirCount}个目录)</div>
      `;
      
      for (const [dirName, dirGroup] of Object.entries(phoneGroup.dirGroups)) {
        groupHtml += `
          <div style="margin-left: 12px; margin-bottom: 4px; padding: 4px 6px; background: rgba(16, 185, 129, 0.05); border-radius: 4px; border-left: 3px solid #10b981;">
            <div style="color: #059669; font-weight: 600; font-size: 9px;">📁 ${dirName} (${dirGroup.devices.length}台)</div>
            <div style="color: #94a3b8; font-size: 8px; margin-top: 2px;">设备: ${dirGroup.devices.map(d => d.deviceCode).join(', ')}</div>
          </div>
        `;
      }
      
      groupHtml += '</div>';
    }
    groupHtml += '</div>';
    
    document.getElementById('cascade2GroupContent').innerHTML = groupHtml;
    document.getElementById('cascade2GroupResult').style.display = 'block';
    
    showStatus(`文件读取成功 - 共${phoneCount}个手机号码，${totalDirGroups}个目录组，${deviceCount}台设备`);
  } catch (err) {
    console.error('处理汇聚功能2文件失败:', err);
    showStatus('处理文件失败: ' + err.message, true);
  }
}

// 下载汇聚功能2模板
function downloadCascade2Template() {
  const csvContent = `设备编码,汇聚手机号码,目标目录
51111110441324005448,13800138000,测试目录1
51111110441324005441,13800138000,测试目录1
51111110441324005442,13900139000,测试目录2
51111110441324005443,13800138000,生产目录
51111110441324005444,13800138000,测试目录1`;
  
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = '汇聚功能2模板.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  
  showStatus('模板下载成功');
}

// 更新汇聚功能2进度条
function updateCascade2Progress(percent, text) {
  const progressFill = document.getElementById('cascade2ProgressFill');
  const progressPercent = document.getElementById('cascade2ProgressPercent');
  const progressText = document.getElementById('cascade2ProgressText');
  
  if (progressFill) progressFill.style.width = percent + '%';
  if (progressPercent) progressPercent.textContent = Math.round(percent) + '%';
  if (progressText) progressText.textContent = text;
}

// 汇聚功能2：查询企业主信息
async function getCustomListForCascade2(phone) {
  const response = await sendVcpMessage('getCustomList', { userId: currentUserId, account: phone });
  if (!response || !response.success) {
    throw new Error(response?.error || '查询企业主失败');
  }
  
  const customData = response.data;
  if (!customData || !customData.data || !customData.data.list) {
    throw new Error('未获取到客户列表');
  }
  
  const qiyezhuList = customData.data.list.filter(item => item.roleName === '企业主');
  if (qiyezhuList.length === 0) {
    throw new Error('该账户不是企业主');
  }
  
  const qiyezhu = qiyezhuList[0];
  return {
    entUserId: qiyezhu.id,
    cascadeCode: qiyezhu.cascadeCode,
    useDeviceCount: qiyezhu.useDeviceCount || 0,
    deviceCount: qiyezhu.deviceCount || 0,
    remainingCount: (qiyezhu.deviceCount || 0) - (qiyezhu.useDeviceCount || 0)
  };
}

// 汇聚功能2：获取企业主根目录列表
async function getLevelCusRegionForCascade2(entUserId) {
  const response = await sendVcpMessage('getLevelCusRegion');
  if (!response || !response.success) {
    throw new Error(response?.error || '获取监控目录失败');
  }
  
  const regionData = response.data;
  if (!regionData || !regionData.data || !regionData.data.cusRegionList) {
    throw new Error('未获取到监控目录数据');
  }
  
  return regionData.data.cusRegionList;
}

// 汇聚功能2：创建目录（如果不存在）
async function ensureRegionExists(regionList, targetDirName, entUserId) {
  if (!targetDirName) return { id: '', name: '' };
  
  // 查找是否已存在同名目录
  const existingRegion = regionList.find(r => r.name === targetDirName);
  if (existingRegion) {
    return { id: existingRegion.id, name: existingRegion.name };
  }
  
  // 不存在则创建新目录（作为根目录）
  const response = await sendVcpMessage('saveRegion', {
    cusRegionNames: targetDirName,
    cusRegionId: '',
    entUserId: entUserId,
    isEdit: false
  });
  
  if (!response || !response.success) {
    throw new Error(response?.error || '创建目录失败');
  }
  
  // 重新获取目录列表以获取新目录ID
  const newRegionList = await getLevelCusRegionForCascade2(entUserId);
  const newRegion = newRegionList.find(r => r.name === targetDirName);
  
  if (newRegion) {
    return { id: newRegion.id, name: newRegion.name };
  }
  
  throw new Error('创建目录后未找到新目录');
}

// 汇聚功能2：查询设备信息
async function getDeviceInfoForCascade2(deviceCodes, userRegionCode = '') {
  const deviceList = [];
  const failedCodes = [];
  const batchSize = 5;

  for (let i = 0; i < deviceCodes.length; i += batchSize) {
    const batch = deviceCodes.slice(i, i + batchSize);
    const batchPromises = batch.map(async (deviceCode) => {
      try {
        const response = await sendVcpMessage('getRegionsByDevTreeType', { 
          deviceCodes: [deviceCode],
          deviceCode: deviceCode,
          regionCode: userRegionCode,
          pageSize: '1000'
        });
        if (response && response.success && response.deviceList && response.deviceList.length > 0) {
          return response.deviceList[0];
        }
        return null;
      } catch (err) {
        console.error(`设备 ${deviceCode} 查询失败:`, err);
        return null;
      }
    });

    const batchResults = await Promise.all(batchPromises);
    for (let j = 0; j < batchResults.length; j++) {
      if (batchResults[j]) {
        deviceList.push(batchResults[j]);
      } else {
        failedCodes.push(batch[j]);
      }
    }
  }

  return { deviceList, failedCodes };
}

/**
 * 汇聚功能2 - 核心处理逻辑：对单个（手机号+目标目录）组合执行级联
 * 
 * 功能说明：
 * 这是汇聚功能2的最小执行单元，处理一个目录组下的所有设备级联操作。
 * 每个目录组 = 一个手机号 + 一个目标目录 + 该目录下的设备列表
 * 
 * 执行流程（5个关键步骤）：
 * 
 * 步骤1：检查级联容量
 *   - 判断企业主剩余的级联路数是否足够
 *   - 如果不足，标记"级联路数不足"并返回失败结果
 * 
 * 步骤2：确保目标目录存在
 *   - 查询企业主的监控根目录列表
 *   - 检查目标目录是否已存在
 *   - 如果不存在，调用saveRegion接口创建新目录
 *   - 获取目录ID和名称，用于后续级联操作
 * 
 * 步骤3：获取用户区域编码(regionCode)
 *   - 调用getUserRegionList接口获取用户的regionCode
 *   - regionCode用于查询设备信息时的参数
 *   - 注意：这个regionCode来自用户信息，不是目录树的code
 * 
 * 步骤4：查询设备详细信息
 *   - 根据设备码批量查询设备的详细信息
 *   - 调用getRegionsByDevTreeType接口
 *   - 参数：deviceCode(设备码) + regionCode(区域编码) + pageSize(每页数量)
 *   - 返回deviceList: [{regionId, deviceCode, regionName, deviceName}]
 *   - 查询失败的设备标记为"设备不存在"
 * 
 * 步骤5：执行级联操作
 *   - 调用createCascadeTask接口创建级联任务
 *   - 将设备级联到指定的目标目录(pRegionId/pRegionName)
 *   - 记录每个设备的级联成功/失败状态
 * 
 * @param {String} phone - 企业主手机号码
 * @param {Object} dirGroup - 目录组对象 { targetDir, devices[] }
 * @param {Object} qiyezhuInfo - 企业主信息 { entUserId, remainingCount, ... }
 * @param {String} userId - 当前操作员ID
 * @param {Function} progressCallback - 进度回调函数(msg) => void
 * @returns {Object} 处理结果 { phone, targetDir, success, message, deviceResults[] }
 */
async function executeCascade2ForDirGroup(phone, dirGroup, qiyezhuInfo, userId, progressCallback) {
  const results = {
    phone,
    targetDir: dirGroup.targetDir,
    success: false,
    message: '',
    deviceResults: []
  };
  
  try {
    // ========== 步骤1：判断级联剩余路数 ==========
    // 业务规则：企业主有级联路数限制，必须确保剩余路数 >= 待级联设备数
    // 例如：剩余10路，要级联15台设备 → 路数不足，无法继续
    const deviceCount = dirGroup.devices.length;
    if (qiyezhuInfo.remainingCount < deviceCount) {
      results.success = false;
      results.message = `级联路数不足 (剩余${qiyezhuInfo.remainingCount}路，需要${deviceCount}路)`;
      // 为该目录下的每台设备都生成失败记录
      for (const device of dirGroup.devices) {
        results.deviceResults.push({
          deviceCode: device.deviceCode,
          success: false,
          message: '级联路数不足'
        });
      }
      return results;
    }
    
    // ========== 步骤2：确保目标目录存在（如果不存在则创建）==========
    // 参考功能：saveRegion（保存/创建目录）
    // 目的：确保设备能级联到正确的目标目录下
    // 逻辑：
    //   1. 获取企业主根目录列表
    //   2. 遍历查找是否有同名的目录
    //   3. 如果找到 → 返回该目录信息(id, name)
    //   4. 如果没找到 → 调用API创建新目录，返回新建的目录信息
    const targetDirName = dirGroup.targetDir || '';
    let regionInfo = { id: '', name: '' };
    
    if (targetDirName && targetDirName !== '默认目录') {
      progressCallback(`正在处理目录: ${targetDirName}...`);
      // 获取企业主的所有目录列表
      const regionList = await getLevelCusRegionForCascade2(qiyezhuInfo.entUserId);
      // 确保目标目录存在（不存在则自动创建）
      regionInfo = await ensureRegionExists(regionList, targetDirName, qiyezhuInfo.entUserId);
      progressCallback(`目录处理完成: ${regionInfo.name}`);
    } else {
      // 目标目录为空或默认值时，不指定具体目录
      regionInfo = { id: '', name: '' };
    }
    
    // ========== 步骤3：获取用户regionCode（用于设备信息查询）==========
    // 接口：getUserRegionList
    // 用途：查询设备信息时需要传入regionCode参数
    // 注意：
    //   - 这个regionCode是用户的区域编码，从getUserRegionList获取
    //   - 不是目录树中的code（两者不同！）
    //   - 用于getRegionsByDevTreeType接口的参数
    let userRegionCode = '';
    try {
      const userRegionResponse = await sendVcpMessage('getUserRegionList', { userId: qiyezhuInfo.entUserId });
      if (userRegionResponse && userRegionResponse.success && userRegionResponse.regionCode) {
        userRegionCode = userRegionResponse.regionCode;
      }
    } catch (err) {
      console.warn('获取用户区域编码失败:', err);
      // regionCode为空时，设备查询可能失败，但不阻断流程
    }
    
    // ========== 步骤4：根据设备码查询设备信息 ==========
    // 接口：getRegionsByDevTreeType
    // URL示例：https://vcp.21cn.com/vcpCamera/oper/custom/getRegionsByDevTreeType?deviceCode=xxx&regionCode=xxx&pageSize=1000
    // 输入：设备码数组 [deviceCode1, deviceCode2, ...]
    // 输出：
    //   - deviceList: 成功查询到的设备列表 [{regionId, deviceCode, regionName, deviceName}]
    //   - failedCodes: 查询失败的设备码数组（这些设备标记为"设备不存在"）
    progressCallback(`正在查询 ${phone} [${dirGroup.targetDir}] 的设备信息...`);
    const deviceCodes = dirGroup.devices.map(d => d.deviceCode);
    const { deviceList, failedCodes } = await getDeviceInfoForCascade2(deviceCodes, userRegionCode);
    
    // 记录查询失败的设备（备注：设备不存在）
    // 原因：设备可能已被删除、设备码错误、或无权限访问
    for (const failedCode of failedCodes) {
      results.deviceResults.push({
        deviceCode: failedCode,
        success: false,
        message: '设备不存在'
      });
    }
    
    // 如果所有设备都查询失败，直接返回
    if (deviceList.length === 0) {
      results.success = false;
      results.message = '所有设备查询失败';
      return results;
    }
    
    // ========== 步骤5：执行级联操作到对应的目标目录 ==========
    // 参考功能：processCascadeBatches（批量处理级联）
    // 接口：createCascadeTask（实际调用addCascadeTaskOperator）
    // 关键参数说明：
    //   - userId: 操作员ID（当前登录用户）
    //   - account: 企业主手机号（被级联方）
    //   - deviceList: 设备信息列表（步骤4查询到的）
    //   - pRegionId: 目标目录ID（步骤2获取的）
    //   - pRegionName: 目标目录名称（步骤2获取的）
    // 执行效果：
    //   - 将deviceList中的设备级联到pRegionId对应的目录下
    //   - 企业主可以在其监控平台看到这些设备
    progressCallback(`正在对 ${phone} [${dirGroup.targetDir}] 执行级联 (${deviceList.length}台设备)...`);
    const response = await sendVcpMessage('createCascadeTask', {
      userId: userId,
      account: phone,
      deviceList: deviceList,
      pRegionId: regionInfo.id,       // 目标目录ID
      pRegionName: regionInfo.name     // 目标目录名称
    });
    
    if (response && response.success) {
      const cascadeResults = response.cascadeResults || [];
      for (const cr of cascadeResults) {
        results.deviceResults.push({
          deviceCode: cr.deviceCode,
          success: cr.success,
          message: cr.message
        });
      }
      const successCount = results.deviceResults.filter(r => r.success).length;
      results.success = successCount > 0;
      results.message = `级联完成: ${successCount}/${results.deviceResults.length} 成功`;
    } else {
      results.success = false;
      results.message = response?.error || '级联失败';
      for (const device of deviceList) {
        results.deviceResults.push({
          deviceCode: device.deviceCode,
          success: false,
          message: response?.error || '级联失败'
        });
      }
    }
  } catch (err) {
    results.success = false;
    results.message = err.message;
    for (const device of dirGroup.devices) {
      results.deviceResults.push({
        deviceCode: device.deviceCode,
        success: false,
        message: err.message
      });
    }
  }
  
  return results;
}

/**
 * 汇聚功能2 - 手机号级别处理：对单个手机号的所有目录组执行级联
 * 
 * 功能说明：
 * 处理一个手机号下的所有目录组，是executeCascade2ForDirGroup的上层调用。
 * 一个手机号可能对应多个目标目录（例如：测试目录、生产目录等）。
 * 
 * 执行流程：
 * 1. 查询企业主信息（只查询一次，所有目录组共用）
 * 2. 遍历该手机号的所有目录组
 *    - 对每个目录组调用 executeCascade2ForDirGroup 进行处理
 *    - 收集每个目录组的处理结果
 * 3. 异常处理：如果企业主查询失败，为每个目录组的每台设备生成失败记录
 * 
 * 设计优化：
 * - 企业主信息只查询一次，避免重复API调用
 * - 每个目录组独立处理，互不影响
 * - 异常时确保所有设备都有记录，不会丢失数据
 * 
 * @param {String} phone - 企业主手机号码
 * @param {Object} phoneGroup - 手机号分组对象 { phone, dirGroups: { dirName: { targetDir, devices[] } } }
 * @param {String} userId - 当前操作员ID
 * @param {Function} progressCallback - 进度回调函数(msg) => void
 * @returns {Array} 所有目录组的处理结果数组 [dirResult1, dirResult2, ...]
 */
async function executeCascade2ForPhone(phone, phoneGroup, userId, progressCallback) {
  const allDirResults = [];
  
  try {
    // ========== 步骤1：查询企业主信息（只查询一次）==========
    // 目的：获取企业主的ID和剩余级联路数
    // 优化：同一个手机号可能有多个目录组，企业主信息只需查询一次
    // 所有目录组共享这个企业主信息对象
    progressCallback(`正在查询 ${phone} 的企业主信息...`);
    const qiyezhuInfo = await getCustomListForCascade2(phone);
    
    // ========== 步骤2：遍历该手机号的所有目录组 ==========
    // 示例：手机号13800138000有2个目录组
    //   - 目录组1: "测试目录" → [设备A, 设备B, 设备C]
    //   - 目录组2: "生产目录" → [设备D, 设备E]
    // 需要分别对每个目录组执行级联操作
    const dirGroups = Object.values(phoneGroup.dirGroups);
    for (let i = 0; i < dirGroups.length; i++) {
      const dirGroup = dirGroups[i];
      progressCallback(`正在处理 ${phone} [${dirGroup.targetDir}] (${i + 1}/${dirGroups.length})...`);
      
      // 调用核心处理函数，传入共享的qiyezhuInfo
      const dirResult = await executeCascade2ForDirGroup(phone, dirGroup, qiyezhuInfo, userId, progressCallback);
      allDirResults.push(dirResult);  // 收集每个目录组的结果
    }
    
  } catch (err) {
    // ========== 异常处理：企业主查询失败 ==========
    // 场景：
    //   - 手机号对应的用户不存在（未注册）
    //   - API调用超时或网络错误
    //   - 权限不足无法查询
    // 处理策略：
    //   - 不中断整个流程
    //   - 为每个目录组的每台设备都生成失败记录
    //   - 确保结果完整，方便后续统计和导出
    
    console.error(`手机号 ${phone} 查询企业主信息失败:`, err);
    
    const dirGroups = Object.values(phoneGroup.dirGroups);
    
    for (const dirGroup of dirGroups) {
      const failResult = {
        phone,
        targetDir: dirGroup.targetDir,
        success: false,
        message: err.message || '企业主不存在或查询失败',
        deviceResults: []
      };
      
      // 为该目录下的每个设备都生成独立的失败记录
      // 这样在结果表格中可以看到每台设备的具体情况
      for (const device of dirGroup.devices) {
        failResult.deviceResults.push({
          deviceCode: device.deviceCode,
          success: false,
          message: err.message || '企业主不存在或查询失败'
        });
      }
      
      allDirResults.push(failResult);
    }
  }
  
  return allDirResults;
}

/**
 * 汇聚功能2 - 主入口：启动批量级联处理流程
 * 
 * 功能说明：
 * 这是汇聚功能2的主控制函数，负责协调整个级联流程。
 * 
 * 执行前检查：
 * 1. 检查是否已上传CSV文件
 * 2. 检查是否已获取当前用户ID
 * 3. 统计总目录组数量并弹出确认框
 * 
 * 主循环逻辑：
 * 遍历所有手机号 → 对每个手机号遍历其目录组 → 对每个目录组执行5步级联流程
 * 
 * 进度追踪：
 * - 按"目录组"为单位统计进度（不是按手机号）
 * - 实时更新进度条和状态文字
 * - 支持取消操作（通过浏览器确认框）
 * 
 * 结果展示：
 * 处理完成后显示详细的结果表格，包含：
 * - 总体统计（成功/失败数量）
 * - 每台设备的详细信息（手机号、目标目录、设备码、状态、原因）
 * - 导出CSV功能
 * 
 * 触发方式：
 * 用户点击"开始汇聚"按钮后调用此函数
 */
async function startCascade2() {
  // ========== 前置检查 ==========
  
  // 检查1：是否已上传CSV文件
  if (!cascade2GroupedData || Object.keys(cascade2GroupedData).length === 0) {
    showStatus('请先上传Excel文件', true);
    return;
  }
  
  // 检查2：是否已获取当前用户ID（用于级联操作的operateAdminId参数）
  if (!currentUserId) {
    showStatus('请先获取用户信息', true);
    return;
  }
  
  // ========== 统计总目录组数量 ==========
  // 统计所有手机号下的目录组总数
  // 示例：3个手机号，每个有2个目录组 → totalDirGroups = 6
  let totalDirGroups = 0;
  for (const phone in cascade2GroupedData) {
    totalDirGroups += Object.keys(cascade2GroupedData[phone].dirGroups).length;
  }
  
  // ========== 用户确认 ==========
  // 弹出确认框，显示将要处理的数量
  // 用户可以选择"确定"继续或"取消"中止
  const confirmMessage = `共 ${Object.keys(cascade2GroupedData).length} 个手机号码，${totalDirGroups} 个目录组需要处理，是否开始级联？`;
  if (!confirm(confirmMessage)) {
    showStatus('已取消级联操作');
    return;
  }
  
  // ========== 初始化进度条UI ==========
  const progressContainer = document.getElementById('cascade2Progress');
  progressContainer.classList.remove('hidden');  // 显示进度条容器
  updateCascade2Progress(0, '正在初始化...');   // 初始化进度为0%
  
  // ========== 准备结果收集数组 ==========
  const allResults = [];              // 存储所有处理结果
  const phones = Object.keys(cascade2GroupedData);  // 所有待处理的手机号列表
  let processedDirGroups = 0;         // 已处理的目录组计数器
  
  // ========== 主循环：遍历每个手机号 ==========
  for (const phone of phones) {
    const phoneGroup = cascade2GroupedData[phone];  // 获取该手机号的分组数据
    
    // 调用手机号处理函数，传入进度回调
    // 该函数会：
    //   1. 查询企业主信息
    //   2. 遍历该手机号的所有目录组
    //   3. 对每个目录组执行5步级联流程
    //   4. 返回该手机号下所有目录组的处理结果数组
    const dirResults = await executeCascade2ForPhone(phone, phoneGroup, currentUserId, (msg) => {
      // 实时更新进度条（显示当前处理的详细信息）
      updateCascade2Progress(
        Math.round((processedDirGroups / totalDirGroups) * 100),  // 计算百分比
        msg  // 显示的消息，如："正在查询 xxx 的企业主信息..."
      );
    });
    
    // ========== 收集该手机号的所有目录组结果 ==========
    for (const dirResult of dirResults) {
      allResults.push(dirResult);      // 将单个目录组的结果添加到总结果中
      processedDirGroups++;             // 已处理计数+1
      
      // 更新总体进度（显示已完成多少个目录组）
      updateCascade2Progress(
        Math.round((processedDirGroups / totalDirGroups) * 100),
        `已完成 ${processedDirGroups}/${totalDirGroups} 个目录组`
      );
    }
  }
  
  // ========== 处理完成 ==========
  updateCascade2Progress(100, '处理完成！');  // 进度设为100%
  
  // 调用结果显示函数，渲染结果表格
  displayCascade2Results(allResults);
  
  // 2秒后自动隐藏进度条（给用户时间查看最终状态）
  setTimeout(() => {
    progressContainer.classList.add('hidden');
  }, 2000);
}

// 汇聚功能2：显示处理结果
function displayCascade2Results(allResults) {
  let totalDevices = 0;
  let totalSuccess = 0;
  let totalFailed = 0;
  
  for (const result of allResults) {
    for (const dr of result.deviceResults) {
      totalDevices++;
      if (dr.success) totalSuccess++;
      else totalFailed++;
    }
  }
  
  let resultHtml = `
    <div style="margin-bottom: 14px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
        <strong style="font-size: 11px; color: #1e293b; font-weight: 700; letter-spacing: -0.3px;">汇聚处理结果 (共${totalDevices}台设备):</strong>
        <div style="display: flex; gap: 16px; font-size: 11px; font-weight: 600;">
          <div style="color: #137333;">成功: ${totalSuccess}台</div>
          <div style="color: #c5221f;">失败: ${totalFailed}台</div>
        </div>
      </div>
      <button id="exportCascade2Btn" style="background: linear-gradient(135deg, #3b82f6 0%, #60a5fa 100%); color: white; border: none; padding: 8px 14px; border-radius: 10px; cursor: pointer; font-size: 10px; font-weight: 700; box-shadow: 0 4px 12px rgba(59, 130, 246, 0.25); letter-spacing: -0.2px; backdrop-filter: blur(10px); border: 1px solid rgba(255, 255, 255, 0.3); transition: all 0.25s ease;">📥 导出结果</button>
    </div>
    <div style="overflow-x: auto;">
      <table class="data-table" style="margin-top: 8px; width: 100%; border-collapse: collapse; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08); background: rgba(255, 255, 255, 0.8); backdrop-filter: blur(10px); border: 1px solid rgba(226, 232, 240, 0.5);">
        <tr style="background: linear-gradient(135deg, rgba(248, 250, 252, 0.9) 0%, rgba(241, 245, 249, 0.9) 100%); border-bottom: 1px solid rgba(226, 232, 240, 0.5); backdrop-filter: blur(10px);">
          <th style="padding: 12px 14px; text-align: left; border: 1px solid rgba(226, 232, 240, 0.5); font-weight: 700; font-size: 9px; color: #1e293b; letter-spacing: -0.2px; text-transform: uppercase; width: 40px;">序号</th>
          <th style="padding: 12px 14px; text-align: left; border: 1px solid rgba(226, 232, 240, 0.5); font-weight: 700; font-size: 9px; color: #1e293b; letter-spacing: -0.2px; text-transform: uppercase;">手机号码</th>
          <th style="padding: 12px 14px; text-align: left; border: 1px solid rgba(226, 232, 240, 0.5); font-weight: 700; font-size: 9px; color: #1e293b; letter-spacing: -0.2px; text-transform: uppercase;">目标目录</th>
          <th style="padding: 12px 14px; text-align: left; border: 1px solid rgba(226, 232, 240, 0.5); font-weight: 700; font-size: 9px; color: #1e293b; letter-spacing: -0.2px; text-transform: uppercase;">设备编码</th>
          <th style="padding: 12px 14px; text-align: left; border: 1px solid rgba(226, 232, 240, 0.5); font-weight: 700; font-size: 9px; color: #1e293b; letter-spacing: -0.2px; text-transform: uppercase;">级联状态</th>
          <th style="padding: 12px 14px; text-align: left; border: 1px solid rgba(226, 232, 240, 0.5); font-weight: 700; font-size: 9px; color: #1e293b; letter-spacing: -0.2px; text-transform: uppercase;">状态信息</th>
        </tr>
  `;
  
  let index = 1;
  for (const result of allResults) {
    for (const dr of result.deviceResults) {
      resultHtml += `
        <tr style="border-bottom: 1px solid rgba(226, 232, 240, 0.5); transition: all 0.2s ease; font-size: 10px; background: ${dr.success ? 'rgba(16, 185, 129, 0.05)' : 'rgba(239, 68, 68, 0.05)'}" onmouseover="this.style.background='rgba(59, 130, 246, 0.05)'" onmouseout="this.style.background='${dr.success ? 'rgba(16, 185, 129, 0.05)' : 'rgba(239, 68, 68, 0.05)'}">
          <td style="padding: 12px 14px; border: 1px solid rgba(226, 232, 240, 0.5); color: #475569; font-weight: 500; text-align: center; width: 40px;">${index++}</td>
          <td style="padding: 12px 14px; border: 1px solid rgba(226, 232, 240, 0.5); color: #1e293b; font-weight: 600; font-size: 10px;">${result.phone}</td>
          <td style="padding: 12px 14px; border: 1px solid rgba(226, 232, 240, 0.5); color: #059669; font-weight: 600; font-size: 10px;">${result.targetDir || '-'}</td>
          <td style="padding: 12px 14px; border: 1px solid rgba(226, 232, 240, 0.5); color: #475569; font-family: 'SF Mono', monospace; font-size: 9px;">${dr.deviceCode || '-'}</td>
          <td style="padding: 12px 14px; border: 1px solid rgba(226, 232, 240, 0.5); color: ${dr.success ? '#137333' : '#c5221f'}; font-weight: 600;">${dr.success ? '成功' : '失败'}</td>
          <td style="padding: 12px 14px; border: 1px solid rgba(226, 232, 240, 0.5); color: #475569; font-size: 10px;">${dr.message || '-'}</td>
        </tr>
      `;
    }
  }
  
  resultHtml += '</table></div>';
  
  document.getElementById('cascade2ResultContent').innerHTML = resultHtml;
  document.getElementById('cascade2Result').style.display = 'block';
  
  // 添加导出按钮事件
  const exportBtn = document.getElementById('exportCascade2Btn');
  if (exportBtn) {
    exportBtn.addEventListener('click', () => {
      exportCascade2Result(allResults);
    });
  }
  
  if (totalFailed === 0) {
    showStatus(`汇聚处理完成，全部${totalSuccess}台设备成功！`, false);
  } else if (totalSuccess > 0) {
    showStatus(`汇聚处理完成，${totalSuccess}台成功，${totalFailed}台失败`, true);
  } else {
    showStatus(`汇聚处理失败，全部${totalDevices}台设备失败`, true);
  }
}

// 汇聚功能2：导出结果
function exportCascade2Result(allResults) {
  if (!allResults || allResults.length === 0) {
    showStatus('没有可导出的数据', true);
    return;
  }
  
  const headers = '序号,手机号码,目标目录,设备编码,级联状态,状态信息';
  const rows = [];
  let index = 1;
  
  for (const result of allResults) {
    for (const dr of result.deviceResults) {
      rows.push(`${index++},${result.phone},"${result.targetDir || '-'}",${dr.deviceCode || '-'},${dr.success ? '成功' : '失败'},"${dr.message || '-'}"`);
    }
  }
  
  exportToCSV('汇聚功能2结果', headers, rows);
}

// 汇聚功能2：清除数据
function clearCascade2Data() {
  document.getElementById('excelFileCascade2').value = '';
  
  const uploadFileGroup = document.getElementById('dropZoneCascade2').closest('.input-group');
  if (uploadFileGroup) uploadFileGroup.style.display = 'block';
  
  document.getElementById('uploadStatsCascade2').style.display = 'none';
  document.getElementById('cascade2GroupResult').style.display = 'none';
  document.getElementById('cascade2Result').style.display = 'none';
  document.getElementById('cascade2Progress').classList.add('hidden');
  
  document.getElementById('uploadStatsContentCascade2').textContent = '-';
  document.getElementById('cascade2GroupContent').textContent = '-';
  document.getElementById('cascade2ResultContent').textContent = '-';
  
  updateCascade2Progress(0, '正在初始化...');
  
  cascade2Data = null;
  cascade2GroupedData = null;
  
  showStatus('汇聚功能2数据已清除', false);
}

// 汇聚功能2事件监听
document.getElementById('startCascade2Btn').addEventListener('click', startCascade2);
document.getElementById('clearCascade2DataBtn').addEventListener('click', clearCascade2Data);

// 汇聚功能2拖放上传
setupDropZone({
  dropZoneId: 'dropZoneCascade2',
  fileInputId: 'excelFileCascade2',
  processFn: processCascade2CSVFile
});

// 汇聚功能2下载模板
document.getElementById('downloadTemplateCascade2').addEventListener('click', (e) => {
  e.preventDefault();
  downloadCascade2Template();
});