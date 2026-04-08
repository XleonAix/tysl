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

async function fetchData() {
  console.log('开始获取Cookie...');
  const tab = await getVcpTab();
  
  console.log('当前标签页:', tab);
  console.log('当前URL:', tab ? tab.url : '未找到标签页');
  
  if (!tab) {
    showStatus('请先登录 <a href="https://vcp.21cn.com/vcpCamera/web/index.html#/nopasslogin" target="_blank">天翼云眼视频监控平台</a>', true);
    console.log('页面URL不匹配');
    return;
  }

  try {
    console.log('发送getCookies消息...');
    const response = await chrome.runtime.sendMessage({ action: 'getCookies' });
    
    console.log('收到cookie响应:', response);
    
    const safeVillageCookie = response['safeVillageCookie'];
    
    console.log('safeVillageCookie:', safeVillageCookie);
    
    if (safeVillageCookie) {
      const cookieFormat = `COOKIE = "safeVillageCookie=${safeVillageCookie}"`;
      document.getElementById('cookieFormat').textContent = cookieFormat;
      showStatus('数据获取成功');
    } else {
      document.getElementById('cookieFormat').textContent = '(未找到 safeVillageCookie)';
      showStatus('请先登录 <a href="https://vcp.21cn.com/vcpCamera/web/index.html#/nopasslogin" target="_blank">天翼云眼视频监控平台</a>', true);
    }
  } catch (err) {
    console.error('获取数据失败:', err);
    showStatus('获取数据失败: ' + err.message, true);
  }
}

async function getUserRegionList(userId) {
  console.log('开始获取用户区域列表...');
  
  try {
    const tab = await getVcpTab();
    
    console.log('当前标签页:', tab);
    console.log('当前URL:', tab ? tab.url : '未找到标签页');
    
    if (!tab) {
      showStatus('请先登录 <a href="https://vcp.21cn.com/vcpCamera/web/index.html#/nopasslogin" target="_blank">天翼云眼视频监控平台</a>', true);
      console.log('页面URL不匹配');
      return;
    }
    
    console.log('发送getUserRegionList消息...');
    const response = await chrome.tabs.sendMessage(tab.id, { 
      action: 'getUserRegionList',
      userId: userId
    });
    
    console.log('收到getUserRegionList响应:', response);
    
    if (response.success) {
      console.log('获取regionCode成功:', response.regionCode);
      showStatus('获取区域代码成功');
    } else {
      showStatus('获取区域代码失败: ' + response.error, true);
    }
  } catch (err) {
    console.error('获取区域代码失败:', err);
    console.error('错误堆栈:', err.stack);
    showStatus('获取区域代码失败: ' + err.message, true);
  }
}

async function getCustomList() {
  console.log('开始获取企业主列表...');
  const userId = currentUserId;
  const account = document.getElementById('enteraccount').value.trim();
  
  console.log('userId:', userId);
  console.log('account:', account);
  
  if (!userId || !account) {
    showStatus('请确保已获取用户ID并输入账号', true);
    console.log('参数不完整');
    return;
  }
  
  if (!/^1[3-9]\d{9}$/.test(account)) {
    showStatus('请输入11位手机号', true);
    console.log('手机号格式不正确');
    return;
  }
  
  clearRegionData();
  
  try {
    const tab = await getVcpTab();
    
    console.log('当前标签页:', tab);
    console.log('当前URL:', tab ? tab.url : '未找到标签页');
    
    if (!tab) {
      showStatus('请先登录 <a href="https://vcp.21cn.com/vcpCamera/web/index.html#/nopasslogin" target="_blank">天翼云眼视频监控平台</a>', true);
      console.log('页面URL不匹配');
      return;
    }
    
    console.log('注入content script...');
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content.js']
    });
    
    console.log('发送getCustomList消息...');
    const response = await chrome.tabs.sendMessage(tab.id, { 
      action: 'getCustomList', 
      userId: userId,
      account: account
    });
    
    console.log('收到getCustomList响应:', response);
    
    if (response.success) {
      const customData = response.data;
      
      console.log('customData:', customData);
      
      if (customData && customData.data && customData.data.list) {
        const list = customData.data.list;
        const qiyezhuList = list.filter(item => item.roleName === '企业主');
        
        console.log('筛选后的企业主列表:', qiyezhuList);
        
        if (qiyezhuList.length > 0) {
          showStatus('该账户是企业主，正在获取监控目录...');
          
          await getUserRegionList(qiyezhuList[0].id);
          
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
    console.error('错误堆栈:', err.stack);
    showStatus('获取客户列表失败: ' + err.message, true);
  }
}

function clearRegionData() {
  document.getElementById('customListResult').style.display = 'none';
  document.getElementById('customList').innerHTML = '-';
  document.getElementById('levelCusRegionResult').style.display = 'none';
  document.getElementById('levelCusRegion').innerHTML = '-';
}

async function getLevelCusRegion() {
  console.log('开始获取监控目录...');
  
  clearRegionData();
  
  try {
    const tab = await getVcpTab();
    
    console.log('当前标签页:', tab);
    console.log('当前URL:', tab ? tab.url : '未找到标签页');
    
    if (!tab) {
      showStatus('请先登录 <a href="https://vcp.21cn.com/vcpCamera/web/index.html#/nopasslogin" target="_blank">天翼云眼视频监控平台</a>', true);
      console.log('页面URL不匹配');
      return;
    }
    
    console.log('发送getLevelCusRegion消息...');
    const response = await chrome.tabs.sendMessage(tab.id, { 
      action: 'getLevelCusRegion'
    });
    
    console.log('收到getLevelCusRegion响应:', response);
    
    if (response.success) {
      const regionData = response.data;
      
      console.log('regionData:', regionData);
      
      if (regionData && regionData.data && regionData.data.cusRegionList) {
        const regionList = regionData.data.cusRegionList;
        
        console.log('监控目录列表:', regionList);
        
        const regionHtml = renderRegionTree(regionList);
        
        document.getElementById('levelCusRegionResult').style.display = 'block';
        document.getElementById('levelCusRegion').innerHTML = regionHtml;
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
    console.error('错误堆栈:', err.stack);
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
      <li class="region-item" style="padding-left: ${indent}px" data-id="${item.id}" data-name="${item.name || ''}" data-has-child="${hasChild}">
        <span class="region-toggle">${toggleIcon}</span>
        <input type="radio" name="region-radio" class="region-radio" data-id="${item.id}" data-name="${item.name || ''}">
        <span class="region-name">${item.name || '未命名'}</span>
        <span class="region-id">(ID: ${item.id})</span>
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
    const hasChild = item.getAttribute('data-has-child') === 'true';
    
    toggle.addEventListener('click', async (e) => {
      e.stopPropagation();
      
      const regionId = item.getAttribute('data-id');
      const regionName = item.getAttribute('data-name');
      
      console.log('点击展开/折叠:', { regionId, regionName, hasChild });
      
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
          const tab = await getVcpTab();
          if (!tab) {
            showStatus('请先打开 vcp.21cn.com 页面', true);
            return;
          }
          const response = await chrome.tabs.sendMessage(tab.id, { 
            action: 'getLevelCusRegion',
            cusRegionId: regionId
          });
          
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
      
      console.log('选中目录:', { regionId, regionName });
      
      (async () => {
        const tab = await getVcpTab();
        if (tab) {
          chrome.tabs.sendMessage(tab.id, { 
            action: 'setSelectedRegion',
            regionId: regionId,
            regionName: regionName
          });
        }
      })();
      
      // 不显示选中的目录信息
    });
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
        
        console.log('=== CSV文件上传统计 ===');
        console.log('总上传条数:', totalUpload);
        console.log('重复条数:', duplicateCount);
        console.log('有效条数:', validCount);
        
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

async function processCSVFile(file) {
  try {
    const result = await readCSVFile(file);
    console.log('CSV文件处理完成:', result);
    
    // 保存背景条引用
    const deviceCodesGroup = document.getElementById('deviceCodes').closest('.input-group');
    const uploadFileGroup = document.getElementById('dropZone').closest('.input-group');
    
    // 显示上传统计信息
    const uploadStatsHtml = `
      <div style="margin-bottom: 14px; padding: 16px; background: rgba(255, 255, 255, 0.7); border-radius: 16px; box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08); backdrop-filter: blur(20px); border: 1px solid rgba(255, 255, 255, 0.5); transition: all 0.3s ease;">
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
        <button id="reuploadBtn" style="margin-top: 12px; width: 100%; background: linear-gradient(135deg, #3b82f6 0%, #60a5fa 100%); color: white; border: none; padding: 10px; border-radius: 10px; cursor: pointer; font-size: 11px; font-weight: 700; box-shadow: 0 4px 12px rgba(59, 130, 246, 0.25); letter-spacing: -0.2px; backdrop-filter: blur(10px); border: 1px solid rgba(255, 255, 255, 0.3); transition: all 0.25s ease;">🔄 重新上传</button>
      </div>
    `;
    
    document.getElementById('uploadStats').style.display = 'block';
    document.getElementById('uploadStatsContent').innerHTML = uploadStatsHtml;
    
    // 隐藏输入和上传文件的控件及其标签和背景条
    if (deviceCodesGroup) {
      deviceCodesGroup.style.display = 'none';
    }
    
    if (uploadFileGroup) {
      uploadFileGroup.style.display = 'none';
    }
    
    // 添加重新上传按钮的事件监听
    document.getElementById('reuploadBtn').addEventListener('click', () => {
      // 显示输入和上传文件的控件
      if (deviceCodesGroup) {
        deviceCodesGroup.style.display = 'block';
      }
      
      if (uploadFileGroup) {
        uploadFileGroup.style.display = 'block';
      }
      
      // 隐藏上传统计信息
      document.getElementById('uploadStats').style.display = 'none';
      
      // 清空文件输入
      document.getElementById('excelFile').value = '';
      
      showStatus('可以重新上传文件');
    });
    
    showStatus(`CSV文件读取成功 - 总上传: ${result.totalUpload}条, 重复: ${result.duplicateCount}条, 有效: ${result.validCount}条`);
  } catch (err) {
    console.error('处理CSV文件失败:', err);
    showStatus('处理CSV文件失败: ' + err.message, true);
  }
}

async function createCascadeTask() {
  console.log('开始创建级联任务...');
  
  const userId = currentUserId;
  const account = document.getElementById('enteraccount').value.trim();
  
  console.log('userId:', userId);
  console.log('account:', account);
  
  if (!userId || !account) {
    showStatus('请确保已获取用户ID并输入账号', true);
    console.log('userId或account为空');
    return;
  }
  
  if (!/^1[3-9]\d{9}$/.test(account)) {
    showStatus('请输入11位手机号', true);
    console.log('手机号格式不正确:', account);
    return;
  }
  
  try {
    const tab = await getVcpTab();
    
    console.log('当前标签页:', tab);
    console.log('当前URL:', tab ? tab.url : '未找到标签页');
    
    if (!tab) {
      showStatus('请先登录 <a href="https://vcp.21cn.com/vcpCamera/web/index.html#/nopasslogin" target="_blank">天翼云眼视频监控平台</a>', true);
      console.log('页面URL不匹配');
      return;
    }
    
    console.log('注入content script...');
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content.js']
    });
    
    // 自动获取设备信息
    console.log('自动获取设备信息...');
    const deviceCodesInput = document.getElementById('deviceCodes').value.trim();
    const excelFile = document.getElementById('excelFile').files[0];
    
    let deviceCodeArray = [];
    
    if (excelFile) {
      console.log('使用已上传的CSV文件');
      
      try {
        const result = await readCSVFile(excelFile);
        deviceCodeArray = result.deviceCodes;
        console.log('从CSV读取的设备编码:', deviceCodeArray);
        showStatus(`使用已上传的CSV文件 - 有效: ${result.validCount}条`);
      } catch (err) {
        console.error('读取CSV文件失败:', err);
        showStatus('读取CSV文件失败: ' + err.message, true);
        return;
      }
    } else if (deviceCodesInput) {
      deviceCodeArray = deviceCodesInput.split(',').map(code => code.trim()).filter(code => code);
      console.log('手动输入的设备编码:', deviceCodeArray);
      
      // 隐藏上传文件的控件及其标签
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
    
    console.log('发送getRegionsByDevTreeType消息...');
    const deviceResponse = await chrome.tabs.sendMessage(tab.id, {
      action: 'getRegionsByDevTreeType',
      deviceCodes: deviceCodeArray
    });
    
    console.log('收到getRegionsByDevTreeType响应:', deviceResponse);
    
    if (!deviceResponse.success) {
      showStatus('获取设备信息失败: ' + deviceResponse.error, true);
      return;
    }
    
    let deviceList = deviceResponse.deviceList;
    
    // 找出获取失败的设备编码
    const successfulDeviceCodes = new Set(deviceList.map(device => device.deviceCode));
    const failedDeviceCodes = deviceCodeArray.filter(code => !successfulDeviceCodes.has(code));
    
    console.log('获取成功的设备列表:', deviceList);
    console.log('deviceList详细信息:', JSON.stringify(deviceList, null, 2));
    console.log('获取失败的设备编码:', failedDeviceCodes);
    console.log('获取失败的设备数量:', failedDeviceCodes.length);
    
    if (deviceList.length === 0) {
      showStatus('所有设备获取失败，请检查设备编码', true);
      return;
    }
    
    // 询问用户是否确认级联
    const confirmMessage = `确认对 ${deviceList.length} 台设备进行级联操作？\n\n成功获取: ${deviceList.length} 台\n获取失败: ${failedDeviceCodes.length} 台`;
    
    if (!confirm(confirmMessage)) {
      showStatus('级联操作已取消', false);
      return;
    }
    
    console.log('发送createCascadeTask消息...');
    const response = await chrome.tabs.sendMessage(tab.id, { 
      action: 'createCascadeTask',
      userId: userId,
      account: account,
      deviceList: deviceList
    });
    
    console.log('收到createCascadeTask响应:', response);
    
    // 无论成功失败，都处理级联结果
    const resultData = response.data;
    const cascadeResults = response.cascadeResults || [];
    
    console.log('级联任务结果:', resultData);
    console.log('级联详细结果:', cascadeResults);
    
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
      
      console.log('生成默认结果 - 成功设备:', successDevices.length);
      console.log('生成默认结果 - 失败设备:', failedDevices.length);
    }
    
    // 添加获取设备信息失败的设备到失败列表
    const deviceInfoFailedDevices = failedDeviceCodes.map(code => ({
      deviceCode: code,
      regionId: '',
      regionName: '',
      deviceName: '',
      success: false,
      message: '设备码错误'
    }));
    
    failedDevices = [...failedDevices, ...deviceInfoFailedDevices];
    
    // 合并成功和失败的设备到一个数组
    const allDevices = [...successDevices, ...failedDevices];
    
    // 确保失败设备信息能够显示
    console.log('最终成功设备数:', successDevices.length);
    console.log('最终失败设备数:', failedDevices.length);
    console.log('获取设备信息失败的设备数:', deviceInfoFailedDevices.length);
    console.log('总设备数:', allDevices.length);
    
    const resultHtml = allDevices.length > 0 ? `
      <div style="margin-bottom: 14px; padding: 16px; background: rgba(255, 255, 255, 0.7); border-radius: 16px; box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08); backdrop-filter: blur(20px); border: 1px solid rgba(255, 255, 255, 0.5); transition: all 0.3s ease;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
          <strong style="font-size: 11px; color: #1e293b; font-weight: 700; letter-spacing: -0.3px;">级联任务结果 (共${allDevices.length}台):</strong>
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
            ${allDevices.map((item, index) => `
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
        <div style="margin-top: 12px; display: flex; justify-content: space-between; font-size: 11px; font-weight: 600;">
          <div style="color: #137333;">成功: ${successDevices.length}台</div>
          <div style="color: #c5221f;">失败: ${failedDevices.length}台</div>
        </div>
      </div>
    ` : '<div class="no-data">没有设备信息</div>';
    
    
    document.getElementById('cascadeTaskResult').style.display = 'block';
    document.getElementById('cascadeTask').innerHTML = resultHtml;
    
    // 添加导出按钮事件监听器
    const exportBtn = document.getElementById('exportCascadeBtn');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => {
        exportCascadeResult(allDevices);
      });
    }
    
    // 只显示清单，不显示顶部状态提示
    // 状态信息已经在清单中体现
  } catch (err) {
    console.error('创建级联任务失败:', err);
    console.error('错误堆栈:', err.stack);
    showStatus('创建级联任务失败: ' + err.message, true);
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
document.getElementById('queryCustomListBtn').addEventListener('click', queryCustomListForDeviceList);
document.getElementById('queryDeviceListBtn').addEventListener('click', queryDeviceList);
document.getElementById('clearDeviceListBtn').addEventListener('click', clearDeviceListData);

// 停止查询按钮
if (document.getElementById('stopQueryBtn')) {
  document.getElementById('stopQueryBtn').addEventListener('click', function() {
    console.log('用户点击了停止查询按钮');
    shouldStopQuery = true;
    showStatus('正在停止查询...', false);
    updateProgress(0, '正在停止查询...');
  });
}

// 拖放上传功能
const dropZone = document.getElementById('dropZone');
const excelFileInput = document.getElementById('excelFile');

// 点击选择文件
dropZone.addEventListener('click', () => {
  excelFileInput.click();
});

// 拖放事件
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
      excelFileInput.files = e.dataTransfer.files;
      console.log('文件已拖放:', file.name);
      // 立即读取文件并显示统计信息
      await processCSVFile(file);
    } else {
      showStatus('请上传CSV文件 (.csv)', true);
    }
  }
});

// 文件选择事件
excelFileInput.addEventListener('change', async (e) => {
  if (e.target.files.length) {
    const file = e.target.files[0];
    console.log('文件已选择:', file.name);
    // 立即读取文件并显示统计信息
    await processCSVFile(file);
  }
});

// 下载模板
const downloadTemplateBtn = document.getElementById('downloadTemplate');
if (downloadTemplateBtn) {
  console.log('找到downloadTemplate元素');
  downloadTemplateBtn.addEventListener('click', (e) => {
    console.log('点击下载模板');
    e.preventDefault();
    try {
      downloadCSVTemplate();
    } catch (err) {
      console.error('下载模板失败:', err);
      showStatus('下载模板失败: ' + err.message, true);
    }
  });
} else {
  console.error('未找到downloadTemplate元素');
}

// 批量设备查询页面的拖放上传功能
const dropZoneQuery = document.getElementById('dropZoneQuery');
const excelFileInputQuery = document.getElementById('excelFileQuery');

if (dropZoneQuery && excelFileInputQuery) {
  // 点击选择文件
  dropZoneQuery.addEventListener('click', () => {
    excelFileInputQuery.click();
  });

  // 拖放事件
  dropZoneQuery.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZoneQuery.style.borderColor = '#4285f4';
    dropZoneQuery.style.backgroundColor = '#f0f7ff';
  });

  dropZoneQuery.addEventListener('dragleave', () => {
    dropZoneQuery.style.borderColor = '#ddd';
    dropZoneQuery.style.backgroundColor = '#f9f9f9';
  });

  dropZoneQuery.addEventListener('drop', async (e) => {
    e.preventDefault();
    dropZoneQuery.style.borderColor = '#ddd';
    dropZoneQuery.style.backgroundColor = '#f9f9f9';
    
    if (e.dataTransfer.files.length) {
      const file = e.dataTransfer.files[0];
      if (file.name.endsWith('.csv')) {
        excelFileInputQuery.files = e.dataTransfer.files;
        console.log('文件已拖放:', file.name);
        // 立即读取文件并显示统计信息
        await processCSVFileQuery(file);
      } else {
        showStatus('请上传CSV文件 (.csv)', true);
      }
    }
  });

  // 文件选择事件
  excelFileInputQuery.addEventListener('change', async (e) => {
    if (e.target.files.length) {
      const file = e.target.files[0];
      console.log('文件已选择:', file.name);
      // 立即读取文件并显示统计信息
      await processCSVFileQuery(file);
    }
  });

  // 下载模板
  const downloadTemplateBtnQuery = document.getElementById('downloadTemplateQuery');
  if (downloadTemplateBtnQuery) {
    console.log('找到downloadTemplateQuery元素');
    downloadTemplateBtnQuery.addEventListener('click', (e) => {
      console.log('点击下载模板');
      e.preventDefault();
      try {
        downloadCSVTemplate();
      } catch (err) {
        console.error('下载模板失败:', err);
        showStatus('下载模板失败: ' + err.message, true);
      }
    });
  } else {
    console.error('未找到downloadTemplateQuery元素');
  }
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
  if (!allDevices || allDevices.length === 0) {
    showStatus('没有可导出的数据', true);
    return;
  }
  
  // 创建CSV格式的导出数据
  const csvContent = `序号,设备UID,设备名字,级联状态,状态信息
${allDevices.map((item, index) => 
  `${index + 1},${item.deviceCode || '-'},${item.deviceName || '-'},${item.success ? '成功' : '失败'},"${item.message || (item.success ? '级联成功' : '级联失败')}"`
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
  a.download = `级联结果_${timestamp}.csv`;
  
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  
  showStatus('级联清单导出成功');
}

// 批量设备查询相关函数
async function processCSVFileQuery(file) {
  try {
    const result = await readCSVFile(file);
    console.log('CSV文件处理完成:', result);
    
    // 保存背景条引用
    const deviceCodesGroup = document.getElementById('deviceCodesQuery').closest('.input-group');
    const uploadFileGroup = document.getElementById('dropZoneQuery').closest('.input-group');
    
    // 显示上传统计信息
    const uploadStatsHtml = `
      <div style="margin-bottom: 14px; padding: 16px; background: rgba(255, 255, 255, 0.7); border-radius: 16px; box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08); backdrop-filter: blur(20px); border: 1px solid rgba(255, 255, 255, 0.5); transition: all 0.3s ease;">
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
        <button id="reuploadBtnQuery" style="margin-top: 12px; width: 100%; background: linear-gradient(135deg, #3b82f6 0%, #60a5fa 100%); color: white; border: none; padding: 10px; border-radius: 10px; cursor: pointer; font-size: 11px; font-weight: 700; box-shadow: 0 4px 12px rgba(59, 130, 246, 0.25); letter-spacing: -0.2px; backdrop-filter: blur(10px); border: 1px solid rgba(255, 255, 255, 0.3); transition: all 0.25s ease;">🔄 重新上传</button>
      </div>
    `;
    
    document.getElementById('uploadStatsQuery').style.display = 'block';
    document.getElementById('uploadStatsContentQuery').innerHTML = uploadStatsHtml;
    
    // 隐藏输入和上传文件的控件及其标签和背景条
    if (deviceCodesGroup) {
      deviceCodesGroup.style.display = 'none';
    }
    
    if (uploadFileGroup) {
      uploadFileGroup.style.display = 'none';
    }
    
    // 添加重新上传按钮的事件监听
    document.getElementById('reuploadBtnQuery').addEventListener('click', () => {
      // 显示输入和上传文件的控件
      if (deviceCodesGroup) {
        deviceCodesGroup.style.display = 'block';
      }
      
      if (uploadFileGroup) {
        uploadFileGroup.style.display = 'block';
      }
      
      // 隐藏上传统计信息
      document.getElementById('uploadStatsQuery').style.display = 'none';
      
      // 清空文件输入
      document.getElementById('excelFileQuery').value = '';
      
      showStatus('可以重新上传文件');
    });
    
    showStatus(`CSV文件读取成功 - 总上传: ${result.totalUpload}条, 重复: ${result.duplicateCount}条, 有效: ${result.validCount}条`);
  } catch (err) {
    console.error('处理CSV文件失败:', err);
    showStatus('处理CSV文件失败: ' + err.message, true);
  }
}

let deviceStatusQueryAbortController = null;

async function queryDeviceStatus() {
  console.log('开始查询设备在线状态...');
  
  try {
    const tab = await getVcpTab();
    
    console.log('当前标签页:', tab);
    console.log('当前URL:', tab ? tab.url : '未找到标签页');
    
    if (!tab) {
      showStatus('请先登录 <a href="https://vcp.21cn.com/vcpCamera/web/index.html#/nopasslogin" target="_blank">天翼云眼视频监控平台</a>', true);
      console.log('页面URL不匹配');
      return;
    }
    
    console.log('注入content script...');
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content.js']
    });
    
    // 获取设备编码
    const deviceCodesInput = document.getElementById('deviceCodesQuery').value.trim();
    const excelFile = document.getElementById('excelFileQuery').files[0];
    
    let deviceCodeArray = [];
    
    if (excelFile) {
      console.log('使用已上传的CSV文件');
      
      try {
        const result = await readCSVFile(excelFile);
        deviceCodeArray = result.deviceCodes;
        console.log('从CSV读取的设备编码:', deviceCodeArray);
        showStatus(`使用已上传的CSV文件 - 有效: ${result.validCount}条`);
      } catch (err) {
        console.error('读取CSV文件失败:', err);
        showStatus('读取CSV文件失败: ' + err.message, true);
        return;
      }
    } else if (deviceCodesInput) {
      deviceCodeArray = deviceCodesInput.split(',').map(code => code.trim()).filter(code => code);
      console.log('手动输入的设备编码:', deviceCodeArray);
      
      // 隐藏上传文件的控件及其标签
      const uploadFileGroup = document.getElementById('dropZoneQuery').closest('.input-group');
      if (uploadFileGroup) {
        uploadFileGroup.style.display = 'none';
      }
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
    
    console.log('发送getDeviceOnlineStatus消息...');
    
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
      
      console.log('收到getDeviceOnlineStatus响应:', response);
      
      if (!response.success) {
        showStatus('查询设备在线状态失败: ' + response.error, true);
        return;
      }
      
      const deviceStatusList = response.deviceStatusList || [];
      console.log('设备在线状态列表:', deviceStatusList);
      
      // 显示查询结果
      const resultHtml = deviceStatusList.length > 0 ? `
        <div style="margin-bottom: 14px; padding: 16px; background: rgba(255, 255, 255, 0.7); border-radius: 16px; box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08); backdrop-filter: blur(20px); border: 1px solid rgba(255, 255, 255, 0.5); transition: all 0.3s ease;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
            <strong style="font-size: 11px; color: #1e293b; font-weight: 700; letter-spacing: -0.3px;">设备在线状态查询结果 (共${deviceStatusList.length}台):</strong>
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
          <div style="margin-top: 12px; display: flex; justify-content: space-between; font-size: 11px; font-weight: 600;">
            <div style="color: #137333;">在线: ${deviceStatusList.filter(item => item.online).length}台</div>
            <div style="color: #c5221f;">离线: ${deviceStatusList.filter(item => !item.online).length}台</div>
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
        console.log('查询已被用户中止');
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
    console.error('错误堆栈:', err.stack);
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
  console.log('清除级联功能页面数据...');
  
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
  document.getElementById('regionResult').classList.add('hidden');
  document.getElementById('customListResult').classList.add('hidden');
  document.getElementById('levelCusRegionResult').classList.add('hidden');
  document.getElementById('uploadStats').classList.add('hidden');
  document.getElementById('cascadeTaskResult').classList.add('hidden');
  
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
  console.log('级联功能页面数据清除完成');
}

// 清除设备查询页面数据
function clearQueryData() {
  console.log('清除设备查询页面数据...');
  
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
  
  // 隐藏结果区域
  document.getElementById('uploadStatsQuery').classList.add('hidden');
  document.getElementById('deviceStatusResult').classList.add('hidden');
  
  // 清空结果内容
  document.getElementById('uploadStatsContentQuery').textContent = '-';
  document.getElementById('deviceStatus').textContent = '-';
  
  // 清除状态信息
  const status = document.getElementById('status');
  status.style.display = 'none';
  
  showStatus('设备查询页面数据已清除', false);
  console.log('设备查询页面数据清除完成');
}

// 画质监测功能
async function queryQuality() {
  console.log('开始查询设备画质...');
  
  try {
    const tab = await getVcpTab();
    
    console.log('当前标签页:', tab);
    console.log('当前URL:', tab ? tab.url : '未找到标签页');
    
    if (!tab) {
      showStatus('请先登录 <a href="https://vcp.21cn.com/vcpCamera/web/index.html#/nopasslogin" target="_blank">天翼云眼视频监控平台</a>', true);
      console.log('页面URL不匹配');
      return;
    }
    
    console.log('注入content script...');
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content.js']
    });
    
    // 获取设备编码
    const deviceCode = document.getElementById('deviceCodeQuality').value.trim();
    
    if (!deviceCode) {
      showStatus('请输入设备编码', true);
      return;
    }
    
    // 显示进度条
    const progressContainer = document.getElementById('qualityProgress');
    const progressFill = document.getElementById('qualityProgressFill');
    const progressPercent = document.getElementById('qualityProgressPercent');
    const progressText = document.getElementById('qualityProgressText');
    
    progressContainer.classList.remove('hidden');
    progressFill.style.width = '0%';
    progressPercent.textContent = '0%';
    progressText.textContent = '正在初始化...';
    
    console.log('发送getDeviceScreenShot消息...');
    
    try {
      const response = await chrome.tabs.sendMessage(tab.id, {
        action: 'getDeviceScreenShot',
        deviceCode: deviceCode
      });
      
      console.log('收到getDeviceScreenShot响应:', response);
      
      if (!response.success) {
        showStatus('查询设备画质失败: ' + response.error, true);
        // 显示错误信息
        document.getElementById('qualityResult').style.display = 'block';
        document.getElementById('qualityImage').style.display = 'none';
        document.getElementById('qualityError').style.display = 'block';
        document.getElementById('qualityError').textContent = response.error || '查询失败';
        return;
      }
      
      const imageUrl = response.imageUrl;
      console.log('设备截图URL:', imageUrl);
      
      // 显示查询结果
      document.getElementById('qualityResult').style.display = 'block';
      document.getElementById('qualityImage').style.display = 'block';
      document.getElementById('qualityError').style.display = 'none';
      document.getElementById('qualityImage').src = imageUrl;
      
      // 添加点击事件监听器，实现图片放大
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
    console.error('错误堆栈:', err.stack);
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
  console.log('清除画质监测页面数据...');
  
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
  console.log('画质监测页面数据清除完成');
}

// 设备清单查询相关函数
async function queryCustomListForDeviceList() {
  console.log('开始查询企业主列表...');
  const userId = currentUserId;
  const account = document.getElementById('deviceListAccount').value.trim();
  
  console.log('userId:', userId);
  console.log('account:', account);
  
  if (!userId || !account) {
    showStatus('请确保已获取用户ID并输入账号', true);
    console.log('参数不完整');
    return;
  }
  
  if (!/^1[3-9]\d{9}$/.test(account)) {
    showStatus('请输入11位手机号', true);
    console.log('手机号格式不正确');
    return;
  }
  
  try {
    const tab = await getVcpTab();
    
    console.log('当前标签页:', tab);
    console.log('当前URL:', tab ? tab.url : '未找到标签页');
    
    if (!tab) {
      showStatus('请先登录 <a href="https://vcp.21cn.com/vcpCamera/web/index.html#/nopasslogin" target="_blank">天翼云眼视频监控平台</a>', true);
      console.log('页面URL不匹配');
      return;
    }
    
    console.log('注入content script...');
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content.js']
    });
    
    console.log('发送getCustomList消息...');
    const response = await chrome.tabs.sendMessage(tab.id, { 
      action: 'getCustomList', 
      userId: userId,
      account: account
    });
    
    console.log('收到getCustomList响应:', response);
    
    if (response.success) {
      const customData = response.data;
      
      console.log('customData:', customData);
      
      if (customData && customData.data && customData.data.list) {
        const list = customData.data.list;
        
        console.log('用户列表:', list);
        
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
            radio.addEventListener('change', (e) => {
              const customId = radio.getAttribute('data-id');
              const customName = radio.getAttribute('data-name');
              console.log('选中用户:', { customId, customName });
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
    console.error('错误堆栈:', err.stack);
    showStatus('获取客户列表失败: ' + err.message, true);
  }
}

async function queryDeviceList() {
  console.log('开始查询设备清单...');
  
  const selectedRadio = document.querySelector('.custom-radio:checked');
  if (!selectedRadio) {
    showStatus('请先选择企业主', true);
  return;
  }
  
  const userId = selectedRadio.getAttribute('data-id');
  const userName = selectedRadio.getAttribute('data-name');
  
  console.log('选择的企业主:', { userId, userName });
  
  try {
    const tab = await getVcpTab();
    
    console.log('当前标签页:', tab);
    console.log('当前URL:', tab ? tab.url : '未找到标签页');
    
    if (!tab) {
      showStatus('请先登录 <a href="https://vcp.21cn.com/vcpCamera/web/index.html#/nopasslogin" target="_blank">天翼云眼视频监控平台</a>', true);
      console.log('页面URL不匹配');
      return;
    }
    
    console.log('注入content script...');
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content.js']
    });
    
    // 重置停止标志
    shouldStopQuery = false;
    
    // 显示进度条和停止按钮
    document.getElementById('deviceListProgress').classList.remove('hidden');
    document.getElementById('stopQueryBtn').style.display = 'inline-block';
    updateProgress(0, '正在初始化...');
    
    // 分页获取所有设备数据
    let allDevices = [];
    let pageNo = 1;
    const pageSize = 10;
    let hasMore = true;
    let totalCount = 0;
    
    showStatus('开始获取设备清单，正在处理...', false);
    
    while (hasMore && !shouldStopQuery) {
      console.log(`获取第 ${pageNo} 页设备数据...`);
      
      // 检查是否需要停止
      if (shouldStopQuery) {
        console.log('用户停止了查询');
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
      
      console.log('收到getEnterpriseUserDeviceList响应:', response);
      
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
        
        // 获取总数
        if (totalCount === 0) {
          totalCount = deviceData.data.total || 0;
        }
        
        console.log(`第 ${pageNo} 页获取到 ${deviceList.length} 条设备数据`);
        console.log(`总数据量: ${totalCount}, 已获取: ${allDevices.length}`);
        
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
        console.log('没有更多数据或数据结构不正确');
        hasMore = false;
      }
    }
    
    // 检查是否是用户停止
    if (shouldStopQuery) {
      console.log('查询被用户停止');
      showStatus('查询已停止', false);
      document.getElementById('deviceListProgress').classList.add('hidden');
      document.getElementById('stopQueryBtn').style.display = 'none';
      return;
    }
    
    // 完成进度
    updateProgress(100, `查询完成！共获取 ${allDevices.length} 台设备`);
    
    console.log('设备清单获取完成，共', allDevices.length, '条数据');
    
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
    console.error('错误堆栈:', err.stack);
    showStatus('查询设备清单失败: ' + err.message, true);
  }
}

function exportDeviceList(deviceList) {
  if (!deviceList || deviceList.length === 0) {
    showStatus('没有可导出的数据', true);
    return;
  }
  
  // 创建CSV格式的导出数据
  const csvContent = `序号,设备名称,设备编码,设备型号,位置
${deviceList.map((item, index) => 
  `${index + 1},${item.deviceName || '-'},${item.deviceCode || '-'},${item.deviceModel || '-'},${item.location || '-'}`
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
  a.download = `设备清单_${timestamp}.csv`;
  
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  
  showStatus('设备清单导出成功');
}

function clearDeviceListData() {
  console.log('清除设备清单查询页面数据...');
  
  // 清除输入框
  document.getElementById('deviceListAccount').value = '';
  
  // 隐藏结果区域
  document.getElementById('customListResultDeviceList').classList.add('hidden');
  document.getElementById('deviceListResult').classList.add('hidden');
  document.getElementById('deviceListProgress').classList.add('hidden');
  
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
  console.log('设备清单查询页面数据清除完成');
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
  if (tab) {
    console.log('页面加载完成，当前URL:', tab.url);
    if (tab.url && tab.url.includes('vcp.21cn.com')) {
      fetchData();
      autoFillUserId();
    }
  }
})();

// 画质监测功能事件监听器
document.getElementById('queryQualityBtn').addEventListener('click', queryQuality);
document.getElementById('clearQualityDataBtn').addEventListener('click', clearQualityData);

// 图片放大模态框事件监听器
document.getElementById('closeModal').addEventListener('click', function() {
  document.getElementById('imageModal').style.display = 'none';
});

// 点击模态框背景关闭
document.getElementById('imageModal').addEventListener('click', function(e) {
  if (e.target === this) {
    this.style.display = 'none';
  }
});

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
let currentAccount = '';

async function autoFillUserId() {
  console.log('开始获取用户信息...');
  
  try {
    const tab = await getVcpTab();
    
    console.log('当前标签页:', tab);
    console.log('当前URL:', tab ? tab.url : '未找到标签页');
    
    if (!tab) {
      console.log('页面URL不匹配');
      return;
    }
    
    console.log('注入content script...');
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content.js']
    });
    
    console.log('发送getUserId消息...');
    const response = await chrome.tabs.sendMessage(tab.id, { 
      action: 'getUserId'
    });
    
    console.log('收到getUserId响应:', response);
    
    if (response.success) {
      const userId = response.userId;
      const account = response.account;
      
      currentUserId = userId;
      currentAccount = account;
      
      console.log('获取到userId:', userId);
      console.log('获取到account:', account);
      
      document.getElementById('userIdDisplay').textContent = maskUserId(userId) || '未检测到用户ID';
      document.getElementById('accountDisplay').textContent = maskPhone(account) || '未检测到手机号';
      
      if (userId) {
        console.log('user_ID:', userId);
      }
      
      showStatus('获取用户信息成功');
    } else {
      console.log('未检测到用户信息');
      document.getElementById('userIdDisplay').textContent = '未检测到用户ID';
      document.getElementById('accountDisplay').textContent = '未检测到手机号';
    }
  } catch (err) {
    console.error('获取用户信息失败:', err);
    console.error('错误堆栈:', err.stack);
    document.getElementById('userIdDisplay').textContent = '获取失败';
    document.getElementById('accountDisplay').textContent = '获取失败';
  }
}