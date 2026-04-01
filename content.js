let cascadeCode = null;
let entUserId = null;
let selectedRegionId = null;
let selectedRegionName = null;
let regionCode_ = null;

function getSessionUserInfo() {
  try {
    const raw = sessionStorage.getItem('user');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch (e) {
    return null;
  }
}

function getCurrentUserInfo() {
  try {
    const sessionUser = getSessionUserInfo();
    if (sessionUser) return sessionUser;

    const app = document.querySelector('#app');
    const store = app && app.__vue__ && app.__vue__.$store;
    return store?.state?.user || store?.state?.loginUser || null;
  } catch (e) {
    return null;
  }
}

function detectOperateAdminId() {
  const user = getCurrentUserInfo();
  if (!user) return '';

  const candidates = [
    user.id,
    user.userId,
    user.adminId,
    user.operAdminId,
    user.operateAdminId,
    user.loginUserId,
    user.userInfo?.id,
    user.userInfo?.userId
  ];

  const matched = candidates.find(v => v !== undefined && v !== null && String(v).trim());
  return matched ? String(matched) : '';
}

function detectAccount() {
  const user = getCurrentUserInfo();
  if (!user) return '';

  const candidates = [
    user.account,
    user.phone,
    user.mobile,
    user.userInfo?.account,
    user.userInfo?.phone,
    user.userInfo?.mobile
  ];

  const matched = candidates.find(v => v !== undefined && v !== null && String(v).trim());
  return matched ? String(matched) : '';
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getUserId') {
    const userId = detectOperateAdminId();
    const account = detectAccount();
    console.log('自动检测到的userId:', userId);
    console.log('自动检测到的account:', account);
    sendResponse({ success: true, userId: userId, account: account });
    return true;
  }

  if (request.action === 'getUserRegionList') {
    const { userId } = request;
    const url = 'https://vcp.21cn.com/vcpCamera/user/getUserRegionList';
    
    const data = new URLSearchParams();
    data.append('userId', userId);
    
    const headers = {
      'Accept': 'application/json, text/plain, */*',
      'Accept-Language': 'zh-CN,zh;q=0.9',
      'Content-Type': 'application/x-www-form-urlencoded'
    };
    
    console.log('Content Script发送请求:', url);
    console.log('请求体:', data.toString());
    
    fetch(url, {
      method: 'POST',
      headers: headers,
      body: data,
      credentials: 'same-origin'
    })
    .then(response => response.json())
    .then(result => {
      console.log('Content Script响应:', result);
      if (result.code === 0 && result.data && result.data.length > 0) {
        regionCode_ = result.data[0].regionCode;
        console.log('全局变量已保存 - regionCode_:', regionCode_);
        sendResponse({ success: true, regionCode: result.data[0].regionCode });
      } else {
        sendResponse({ success: false, error: result.msg || '用户未登录，请登录！' });
      }
    })
    .catch(err => {
      console.error('Content Script请求失败:', err);
      sendResponse({ success: false, error: err.message });
    });
    
    return true;
  }
  
  if (request.action === 'getCustomList') {
    const { userId, account } = request;
    const url = 'https://vcp.21cn.com/vcpCamera/oper/custom/getCustomList';
    
    const params = new URLSearchParams({
      pageNo: '1',
      pageSize: '50',
      userId: userId,
      account: account
    });
    
    const headers = {
      'Accept': 'application/json, text/plain, */*',
      'Accept-Language': 'zh-CN,zh;q=0.9'
    };
    
    console.log('Content Script发送请求:', url);
    console.log('请求参数:', params.toString());
    
    fetch(`${url}?${params.toString()}`, {
      method: 'GET',
      headers: headers,
      credentials: 'same-origin'
    })
    .then(response => response.json())
    .then(result => {
      console.log('Content Script响应:', result);
      
      if (result.data && result.data.list) {
        const qiyezhuList = result.data.list.filter(item => item.roleName === '企业主');
        
        if (qiyezhuList.length > 0) {
          cascadeCode = qiyezhuList[0].cascadeCode;
          entUserId = qiyezhuList[0].id;
          console.log('全局变量已保存 - cascadeCode:', cascadeCode, 'entUserId:', entUserId);
        }
      }
      
      sendResponse({ success: true, data: result });
    })
    .catch(err => {
      console.error('Content Script请求失败:', err);
      sendResponse({ success: false, error: err.message });
    });
    
    return true;
  }
  
  if (request.action === 'getGlobalValues') {
    console.log('获取全局变量 - cascadeCode:', cascadeCode, 'entUserId:', entUserId);
    sendResponse({ 
      success: true, 
      cascadeCode: cascadeCode, 
      entUserId: entUserId 
    });
    return true;
  }
  
  if (request.action === 'getLevelCusRegion') {
    const { cusRegionId = '' } = request;
    const url = 'https://vcp.21cn.com/vcpCamera/cusRegion/getLevelCusRegion';
    
    const params = new URLSearchParams({
      cusRegionId: cusRegionId,
      type: '1',
      role: '8',
      entUserId: entUserId || ''
    });
    
    const headers = {
      'Accept': 'application/json, text/plain, */*',
      'Accept-Language': 'zh-CN,zh;q=0.9'
    };
    
    console.log('Content Script发送请求:', url);
    console.log('请求参数:', params.toString());
    
    fetch(`${url}?${params.toString()}`, {
      method: 'GET',
      headers: headers,
      credentials: 'same-origin'
    })
    .then(response => response.json())
    .then(result => {
      console.log('Content Script响应:', result);
      
      if (result && result.data && result.data.cusRegionList) {
        const processRegionList = (regionList) => {
          return regionList.map(item => {
            const hasChild = item.hasChild === 1 || item.hasChild === '1' || item.hasChild === true;
            
            if (hasChild && item.children) {
              return {
                ...item,
                hasChild: hasChild,
                children: processRegionList(item.children)
              };
            }
            
            return {
              ...item,
              hasChild: hasChild
            };
          });
        };
        
        result.data.cusRegionList = processRegionList(result.data.cusRegionList);
      }
      
      sendResponse({ success: true, data: result });
    })
    .catch(err => {
      console.error('Content Script请求失败:', err);
      sendResponse({ success: false, error: err.message });
    });
    
    return true;
  }
  
  if (request.action === 'getRegionsByDevTreeType') {
    const { deviceCodes } = request;
    const url = 'https://vcp.21cn.com/vcpCamera/oper/custom/getRegionsByDevTreeType';
    
    const headers = {
      'Accept': 'application/json, text/plain, */*',
      'Accept-Language': 'zh-CN,zh;q=0.9',
      'Content-Type': 'application/json'
    };
    
    console.log('Content Script发送请求:', url);
    console.log('设备编码列表:', deviceCodes);
    
    const deviceList = [];
    console.log("regionCode_",regionCode_)
    const fetchPromises = deviceCodes.map(deviceCode => {
      const params = new URLSearchParams({
        deviceCode: deviceCode,
        regionCode: regionCode_ || '',
        pageSize: '1000'
      });
      
      return fetch(`${url}?${params.toString()}`, {
        method: 'GET',
        headers: headers,
        credentials: 'same-origin'
      })
      .then(response => response.json())
      .then(result => {
        console.log(`设备 ${deviceCode} 响应:`, result);
        
        if (result && result.data && result.data.searchRegionDetailRespDtoList && result.data.searchRegionDetailRespDtoList.length > 0) {
          const deviceInfo = result.data.searchRegionDetailRespDtoList[0];
          deviceList.push({
            regionId: deviceInfo.regionCode || '',
            deviceCode: deviceInfo.deviceCode || '',
            regionName: deviceInfo.name || '',
            deviceName: deviceInfo.deviceName || ''
          });
          console.log(`✓ 成功获取设备信息: ${deviceInfo.deviceName || deviceInfo.name}`);
        } else {
          console.log(`✗ 设备 ${deviceCode} 不存在或获取失败`);
        }
      })
      .catch(err => {
        console.error(`✗ 设备 ${deviceCode} 请求失败:`, err);
      });
    });
    
    Promise.all(fetchPromises).then(() => {
      console.log('=== 设备信息获取完成 ===');
      console.log('设备数量:', deviceList.length);
      console.log('deviceList:', deviceList);
      console.log('deviceList详细信息:');
      console.dir(deviceList);
      sendResponse({ success: true, deviceList: deviceList });
    });
    
    return true;
  }
  
  if (request.action === 'getSelectedRegion') {
    console.log('获取选中的目录 - regionId:', selectedRegionId, 'regionName:', selectedRegionName);
    sendResponse({ 
      success: true, 
      regionId: selectedRegionId, 
      regionName: selectedRegionName 
    });
    return true;
  }
  
  if (request.action === 'createCascadeTask') {
    const { userId, account, deviceList } = request;
    const url = 'https://vcp.21cn.com/vcpCamera/cascade/addCascadeTaskOperator';
    
    const taskData = {
      livePer: '1',
      backSeePer: '1',
      voicePer: '1',
      warnInfoPer: '1',
      aiServicePer: '1',
      faceRecognitionPer: '0',
      vehicleRecognitionPer: '0',
      cascadeCode: cascadeCode || '',
      deviceList: deviceList,
      taskType: 1,
      source: 1,
      deviceCount: deviceList.length,
      operateAdminId: userId,
      packageStrategy: 2,
      customAccount: account,
      pRegionId: selectedRegionId || '',
      pRegionName: selectedRegionName || ''
    };
    
    const headers = {
      'Accept': 'application/json, text/plain, */*',
      'Accept-Language': 'zh-CN,zh;q=0.9',
      'Content-Type': 'application/json'
    };
    
    console.log('=== 级联任务请求 ===');
    console.log('请求地址:', url);
    console.log('请求头:', JSON.stringify(headers, null, 2));
    console.log('任务数据:', JSON.stringify(taskData, null, 2));
    
    fetch(url, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(taskData),
      credentials: 'same-origin'
    })
    .then(response => {
      console.log('=== 级联任务响应 ===');
      console.log('响应状态:', response.status);
      console.log('响应状态文本:', response.statusText);
      return response.json();
    })
    .then(result => {
      console.log('响应数据:', JSON.stringify(result, null, 2));
      
      // 判断API是否成功
      const isSuccess = result.code === 20000 || result.code === 0 || result.code === 200;
      
      // 生成级联详细结果
      const cascadeResults = deviceList.map(device => {
        // 模拟级联结果，实际应用中可能需要根据API返回的详细信息
        // 这里简单判断：如果任务创建成功，所有设备都视为级联成功
        return {
          deviceCode: device.deviceCode,
          regionId: device.regionId,
          regionName: device.regionName,
          deviceName: device.deviceName,
          success: isSuccess,
          message: isSuccess ? '级联成功' : result.msg || '级联失败'
        };
      });
      
      sendResponse({ 
        success: true, 
        data: result, 
        cascadeResults: cascadeResults 
      });
    })
    .catch(err => {
      console.error('Content Script请求失败:', err);
      
      // 生成失败的级联结果
      const cascadeResults = deviceList.map(device => {
        return {
          deviceCode: device.deviceCode,
          regionId: device.regionId,
          regionName: device.regionName,
          deviceName: device.deviceName,
          success: false,
          message: err.message || '网络错误'
        };
      });
      
      sendResponse({ 
        success: false, 
        error: err.message,
        cascadeResults: cascadeResults 
      });
    });
    
    return true;
  }
  
  if (request.action === 'setSelectedRegion') {
    const { regionId, regionName } = request;
    selectedRegionId = regionId;
    selectedRegionName = regionName;
    console.log('全局变量已保存 - selectedRegionId:', selectedRegionId, 'selectedRegionName:', selectedRegionName);
    sendResponse({ success: true });
    return true;
  }
  
  if (request.action === 'getDeviceOnlineStatus') {
    const { deviceCodes } = request;
    const deviceInfoUrl = 'https://vcp.21cn.com/vcpCamera/device/getUserDeviceListByEs';
    const deviceStatusUrl = 'https://vcp.21cn.com/vcpCamera/device/getDeviceOnlineStatus';
    
    const headers = {
      'Accept': 'application/json, text/plain, */*',
      'Accept-Language': 'zh-CN,zh;q=0.9'
    };
    
    console.log('Content Script发送请求:', deviceInfoUrl);
    console.log('设备编码列表:', deviceCodes);
    
    const deviceStatusList = [];
    const deviceInfoMap = new Map();
    
    // 第一步：逐个获取设备信息
    const fetchPromises = deviceCodes.map(deviceCode => {
      const params = new URLSearchParams({
        deviceCode: deviceCode,
        size: '20',
        queryType: '0',
        deviceType: '0'
      });
      
      return fetch(`${deviceInfoUrl}?${params.toString()}`, {
        method: 'GET',
        headers: headers,
        credentials: 'same-origin'
      })
      .then(response => response.json())
      .then(result => {
        console.log(`设备 ${deviceCode} 信息响应:`, result);
        
        // 判断API返回的数据，code为0且data为空数组表示设备编码有误
        if (result && result.code === 0 && (!result.data || result.data.length === 0)) {
          console.log(`✗ 设备 ${deviceCode} 编码有误 (code: 0, data: [])`);
          deviceInfoMap.set(deviceCode, {
            deviceName: '',
            deviceCode: deviceCode,
            valid: false
          });
          // 直接标记为设备编码有误
          deviceStatusList.push({
            deviceCode: deviceCode,
            deviceName: '',
            online: false,
            message: '设备编码有误'
          });
          return;
        }
        
        if (result && result.data && result.data.length > 0) {
          const deviceInfo = result.data[0];
          deviceInfoMap.set(deviceCode, {
            deviceName: deviceInfo.deviceName || deviceInfo.name || '',
            deviceCode: deviceInfo.deviceCode || deviceCode,
            valid: true
          });
          console.log(`✓ 成功获取设备信息: ${deviceInfo.deviceName || deviceInfo.name}`);
        } else {
          console.log(`✗ 设备 ${deviceCode} 不存在或获取失败`);
          deviceInfoMap.set(deviceCode, {
            deviceName: '',
            deviceCode: deviceCode,
            valid: false
          });
          // 直接标记为设备编码有误
          deviceStatusList.push({
            deviceCode: deviceCode,
            deviceName: '',
            online: false,
            message: '设备编码有误'
          });
        }
      })
      .catch(err => {
        console.error(`✗ 设备 ${deviceCode} 请求失败:`, err);
        deviceInfoMap.set(deviceCode, {
          deviceName: '',
          deviceCode: deviceCode,
          valid: false
        });
        // 直接标记为设备编码有误
        deviceStatusList.push({
          deviceCode: deviceCode,
          deviceName: '',
          online: false,
          message: '设备编码有误'
        });
      });
    });
    
    Promise.all(fetchPromises).then(() => {
      console.log('=== 设备信息获取完成 ===');
      console.log('设备信息映射:', deviceInfoMap);
      
      // 第二步：只对有效的设备查询在线状态
      const validDeviceCodes = deviceCodes.filter(deviceCode => {
        const deviceInfo = deviceInfoMap.get(deviceCode);
        return deviceInfo && deviceInfo.valid;
      });
      
      console.log('有效设备编码:', validDeviceCodes);
      
      if (validDeviceCodes.length === 0) {
        console.log('没有有效的设备编码，直接返回结果');
        sendResponse({ success: true, deviceStatusList: deviceStatusList });
        return;
      }
      
      const statusPromises = validDeviceCodes.map(deviceCode => {
        const params = new URLSearchParams({
          deviceCode: deviceCode
        });
        
        console.log(`查询设备 ${deviceCode} 在线状态:`, `${deviceStatusUrl}?${params.toString()}`);
        
        return fetch(`${deviceStatusUrl}?${params.toString()}`, {
          method: 'GET',
          headers: headers,
          credentials: 'same-origin'
        })
        .then(response => {
          console.log(`设备 ${deviceCode} 在线状态响应:`, response.status);
          return response.json();
        })
        .then(result => {
          console.log(`设备 ${deviceCode} 在线状态数据:`, JSON.stringify(result, null, 2));
          
          const deviceInfo = deviceInfoMap.get(deviceCode) || { deviceName: '', deviceCode: deviceCode };
          
          if (result && result.data !== undefined) {
            const deviceStatus = result.data;
            console.log(`设备 ${deviceCode} 在线状态值:`, deviceStatus, `(1=在线, 0=离线)`);
            
            const isOnline = deviceStatus === 1;
            console.log(`设备 ${deviceCode} 判断结果:`, isOnline ? '在线' : '离线');
            
            deviceStatusList.push({
              deviceCode: deviceCode,
              deviceName: deviceInfo.deviceName,
              online: isOnline,
              message: isOnline ? '设备在线' : '设备离线'
            });
          } else {
            console.log(`设备 ${deviceCode} 查询失败:`, result);
            deviceStatusList.push({
              deviceCode: deviceCode,
              deviceName: deviceInfo.deviceName,
              online: false,
              message: '查询失败: ' + (result.msg || '未知错误')
            });
          }
        })
        .catch(err => {
          console.error(`设备 ${deviceCode} 在线状态查询失败:`, err);
          
          const deviceInfo = deviceInfoMap.get(deviceCode) || { deviceName: '', deviceCode: deviceCode };
          deviceStatusList.push({
            deviceCode: deviceCode,
            deviceName: deviceInfo.deviceName,
            online: false,
            message: '网络错误: ' + err.message
          });
        });
      });
      
      Promise.all(statusPromises).then(() => {
        console.log('=== 设备在线状态查询完成 ===');
        console.log('设备数量:', deviceStatusList.length);
        console.log('设备状态列表:', deviceStatusList);
        
        sendResponse({ success: true, deviceStatusList: deviceStatusList });
      });
    });
    
    return true;
  }
});
