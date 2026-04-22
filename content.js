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

const DEFAULT_HEADERS = {
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'zh-CN,zh;q=0.9'
};

function vcpFetch(url, options = {}) {
  return fetch(url, {
    ...options,
    headers: { ...DEFAULT_HEADERS, ...(options.headers || {}) },
    credentials: 'same-origin'
  }).then(response => {
    if (response.url.includes('unifyAccountLogout.do')) {
      return Promise.reject(new Error('需要登录'));
    }
    return response.json();
  });
}

function vcpGet(url, params) {
  const queryString = params ? `?${params.toString()}` : '';
  return vcpFetch(`${url}${queryString}`);
}

function vcpPost(url, data, contentType = 'application/x-www-form-urlencoded') {
  return vcpFetch(url, {
    method: 'POST',
    headers: { 'Content-Type': contentType },
    body: contentType === 'application/json' ? JSON.stringify(data) : data
  });
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getUserId') {
    const userId = detectOperateAdminId();
    const account = detectAccount();
    sendResponse({ success: true, userId: userId, account: account });
    return true;
  }

  if (request.action === 'getUserRegionList') {
    const { userId } = request;
    const data = new URLSearchParams();
    data.append('userId', userId);

    vcpPost('https://vcp.21cn.com/vcpCamera/user/getUserRegionList', data)
      .then(result => {
        if (result.code === 0 && result.data && result.data.length > 0) {
          regionCode_ = result.data[0].regionCode;
          sendResponse({ success: true, regionCode: result.data[0].regionCode });
        } else {
          sendResponse({ success: false, error: result.msg || '用户未登录，请登录！' });
        }
      })
      .catch(err => {
        console.error('getUserRegionList失败:', err);
        sendResponse({ success: false, error: err.message });
      });

    return true;
  }

  if (request.action === 'getCustomList') {
    const { userId, account } = request;
    const params = new URLSearchParams({
      pageNo: '1',
      pageSize: '50',
      userId: userId,
      account: account
    });

    vcpGet('https://vcp.21cn.com/vcpCamera/oper/custom/getCustomList', params)
      .then(result => {
        if (result.data && result.data.list) {
          const qiyezhuList = result.data.list.filter(item => item.roleName === '企业主');
          if (qiyezhuList.length > 0) {
            cascadeCode = qiyezhuList[0].cascadeCode;
            entUserId = qiyezhuList[0].id;
          }
        }
        sendResponse({ success: true, data: result });
      })
      .catch(err => {
        console.error('getCustomList失败:', err);
        sendResponse({ success: false, error: err.message });
      });

    return true;
  }

  if (request.action === 'getGlobalValues') {
    sendResponse({
      success: true,
      cascadeCode: cascadeCode,
      entUserId: entUserId
    });
    return true;
  }

  if (request.action === 'getLevelCusRegion') {
    const { cusRegionId = '' } = request;
    const params = new URLSearchParams({
      cusRegionId: cusRegionId,
      type: '1',
      role: '8',
      entUserId: entUserId || ''
    });

    vcpGet('https://vcp.21cn.com/vcpCamera/cusRegion/getLevelCusRegion', params)
      .then(result => {
        if (result && result.data && result.data.cusRegionList) {
          const processRegionList = (regionList) => {
            return regionList.map(item => {
              const hasChild = item.hasChild === 1 || item.hasChild === '1' || item.hasChild === true;
              if (hasChild && item.children) {
                return { ...item, hasChild, children: processRegionList(item.children) };
              }
              return { ...item, hasChild };
            });
          };
          result.data.cusRegionList = processRegionList(result.data.cusRegionList);
        }
        sendResponse({ success: true, data: result });
      })
      .catch(err => {
        console.error('getLevelCusRegion失败:', err);
        sendResponse({ success: false, error: err.message });
      });

    return true;
  }

  if (request.action === 'getRegionsByDevTreeType') {
    const { deviceCodes } = request;
    const url = 'https://vcp.21cn.com/vcpCamera/oper/custom/getRegionsByDevTreeType';
    const deviceList = [];
    const batchSize = 5;
    const totalDevices = deviceCodes.length;
    let processedCount = 0;

    function sendProgressUpdate(current, total, deviceCode) {
      const progress = Math.round((current / total) * 100);
      chrome.runtime.sendMessage({
        action: 'cascadeProgress',
        progress: progress,
        current: current,
        total: total,
        deviceCode: deviceCode,
        step: '获取设备信息'
      });
    }

    async function processBatches() {
      for (let i = 0; i < deviceCodes.length; i += batchSize) {
        const batch = deviceCodes.slice(i, i + batchSize);
        const batchPromises = batch.map(deviceCode => {
          const params = new URLSearchParams({
            deviceCode: deviceCode,
            regionCode: regionCode_ || '',
            pageSize: '1000'
          });

          return vcpGet(url, params)
            .then(result => {
              if (result && result.data && result.data.searchRegionDetailRespDtoList && result.data.searchRegionDetailRespDtoList.length > 0) {
                const deviceInfo = result.data.searchRegionDetailRespDtoList[0];
                deviceList.push({
                  regionId: deviceInfo.regionCode || '',
                  deviceCode: deviceInfo.deviceCode || '',
                  regionName: deviceInfo.name || '',
                  deviceName: deviceInfo.deviceName || ''
                });
              }
            })
            .catch(err => {
              console.error(`设备 ${deviceCode} 请求失败:`, err);
            })
            .finally(() => {
              processedCount++;
              sendProgressUpdate(processedCount, totalDevices, deviceCode);
            });
        });
        await Promise.all(batchPromises);
      }
      sendResponse({ success: true, deviceList: deviceList });
    }

    processBatches();
    return true;
  }

  if (request.action === 'getSelectedRegion') {
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

    if (!cascadeCode) {
      const cascadeResults = deviceList.map(device => ({
        deviceCode: device.deviceCode,
        regionId: device.regionId,
        regionName: device.regionName,
        deviceName: device.deviceName,
        success: false,
        message: 'cascadeCode 为空，无法执行级联操作'
      }));
      sendResponse({
        success: false,
        error: 'cascadeCode 为空，无法执行级联操作',
        cascadeResults: cascadeResults
      });
      return true;
    }

    const batchSize = 800;
    const totalDevices = deviceList.length;
    let processedCount = 0;
    const allCascadeResults = [];

    function sendProgressUpdate(current, total, deviceCode) {
      const progress = Math.round((current / total) * 100);
      chrome.runtime.sendMessage({
        action: 'cascadeProgress',
        progress: progress,
        current: current,
        total: total,
        deviceCode: deviceCode,
        step: '执行级联操作'
      });
    }

    function delay(ms) {
      return new Promise(resolve => setTimeout(resolve, ms));
    }

    async function processCascadeBatches() {
      for (let i = 0; i < deviceList.length; i += batchSize) {
        const batch = deviceList.slice(i, i + batchSize);

        const taskData = {
          livePer: '1',
          backSeePer: '1',
          voicePer: '1',
          warnInfoPer: '1',
          aiServicePer: '1',
          faceRecognitionPer: '0',
          vehicleRecognitionPer: '0',
          cascadeCode: cascadeCode,
          deviceList: batch,
          taskType: 1,
          source: 1,
          deviceCount: batch.length,
          operateAdminId: userId,
          packageStrategy: 2,
          customAccount: account,
          pRegionId: selectedRegionId || '',
          pRegionName: selectedRegionName || '',
          regionCode: regionCode_ || ''
        };

        try {
          const result = await vcpFetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(taskData)
          });

          const isSuccess = result.code === 20000 || result.code === 0 || result.code === 200;
          const batchResults = batch.map(device => ({
            deviceCode: device.deviceCode,
            regionId: device.regionId,
            regionName: device.regionName,
            deviceName: device.deviceName,
            success: isSuccess,
            message: isSuccess ? '级联成功' : result.msg || '级联失败'
          }));
          allCascadeResults.push(...batchResults);

          for (const device of batch) {
            processedCount++;
            sendProgressUpdate(processedCount, totalDevices, device.deviceCode);
          }
        } catch (err) {
          console.error('级联请求失败:', err);
          const batchResults = batch.map(device => ({
            deviceCode: device.deviceCode,
            regionId: device.regionId,
            regionName: device.regionName,
            deviceName: device.deviceName,
            success: false,
            message: err.message || '网络错误'
          }));
          allCascadeResults.push(...batchResults);

          for (const device of batch) {
            processedCount++;
            sendProgressUpdate(processedCount, totalDevices, device.deviceCode);
          }
        }


      }

      sendResponse({
        success: true,
        data: { code: 20000, msg: '级联操作完成' },
        cascadeResults: allCascadeResults
      });
    }

    processCascadeBatches();
    return true;
  }

  if (request.action === 'setSelectedRegion') {
    const { regionId, regionName } = request;
    selectedRegionId = regionId;
    selectedRegionName = regionName;
    sendResponse({ success: true });
    return true;
  }

  if (request.action === 'getDeviceOnlineStatus') {
    const { deviceCodes } = request;
    const deviceInfoUrl = 'https://vcp.21cn.com/vcpCamera/device/getUserDeviceListByEs';
    const deviceStatusUrl = 'https://vcp.21cn.com/vcpCamera/device/getDeviceOnlineStatus';

    const deviceStatusList = [];
    const deviceInfoMap = new Map();
    let processedCount = 0;
    const totalCount = deviceCodes.length;

    function sendProgressUpdate(current, deviceCode) {
      const progress = Math.round((current / totalCount) * 100);
      chrome.runtime.sendMessage({
        action: 'deviceStatusProgress',
        progress: progress,
        current: current,
        total: totalCount,
        deviceCode: deviceCode
      });
    }

    const fetchPromises = deviceCodes.map((deviceCode) => {
      const params = new URLSearchParams({
        deviceCode: deviceCode,
        size: '20',
        queryType: '0',
        deviceType: '0'
      });

      return vcpGet(deviceInfoUrl, params)
        .then(result => {
          if (result && result.code === 0 && (!result.data || result.data.length === 0)) {
            deviceInfoMap.set(deviceCode, { deviceName: '', deviceCode, valid: false });
            deviceStatusList.push({
              deviceCode,
              deviceName: '',
              online: false,
              message: '设备编码有误'
            });
          } else if (result && result.data && result.data.length > 0) {
            const deviceInfo = result.data[0];
            deviceInfoMap.set(deviceCode, {
              deviceName: deviceInfo.deviceName || deviceInfo.name || '',
              deviceCode: deviceInfo.deviceCode || deviceCode,
              valid: true
            });
          } else {
            deviceInfoMap.set(deviceCode, { deviceName: '', deviceCode, valid: false });
            deviceStatusList.push({
              deviceCode,
              deviceName: '',
              online: false,
              message: '设备编码有误'
            });
          }
        })
        .catch(err => {
          console.error(`设备 ${deviceCode} 请求失败:`, err);
          deviceInfoMap.set(deviceCode, { deviceName: '', deviceCode, valid: false });
          deviceStatusList.push({
            deviceCode,
            deviceName: '',
            online: false,
            message: '设备编码有误'
          });
        })
        .finally(() => {
          processedCount++;
          sendProgressUpdate(processedCount, deviceCode);
        });
    });

    Promise.all(fetchPromises).then(() => {
      const validDeviceCodes = deviceCodes.filter(deviceCode => {
        const info = deviceInfoMap.get(deviceCode);
        return info && info.valid;
      });

      if (validDeviceCodes.length === 0) {
        sendResponse({ success: true, deviceStatusList: deviceStatusList });
        return;
      }

      const statusPromises = validDeviceCodes.map(deviceCode => {
        const params = new URLSearchParams({ deviceCode });

        return vcpGet(deviceStatusUrl, params)
          .then(result => {
            const deviceInfo = deviceInfoMap.get(deviceCode) || { deviceName: '', deviceCode };
            if (result && result.data !== undefined) {
              const isOnline = result.data === 1;
              deviceStatusList.push({
                deviceCode,
                deviceName: deviceInfo.deviceName,
                online: isOnline,
                message: isOnline ? '设备在线' : '设备离线'
              });
            } else {
              deviceStatusList.push({
                deviceCode,
                deviceName: deviceInfo.deviceName,
                online: false,
                message: '查询失败: ' + (result.msg || '未知错误')
              });
            }
          })
          .catch(err => {
            console.error(`设备 ${deviceCode} 在线状态查询失败:`, err);
            const deviceInfo = deviceInfoMap.get(deviceCode) || { deviceName: '', deviceCode };
            deviceStatusList.push({
              deviceCode,
              deviceName: deviceInfo.deviceName,
              online: false,
              message: '网络错误: ' + err.message
            });
          });
      });

      Promise.all(statusPromises).then(() => {
        sendResponse({ success: true, deviceStatusList: deviceStatusList });
      });
    });

    return true;
  }

  if (request.action === 'getEnterpriseUserDeviceList') {
    const { userId, pageNo, pageSize } = request;
    const params = new URLSearchParams({ userId, pageNo, pageSize });

    vcpGet('https://vcp.21cn.com/vcpCamera/device/getEnterpriseUserDeviceList', params)
      .then(result => {
        sendResponse({ success: true, data: result });
      })
      .catch(err => {
        console.error('getEnterpriseUserDeviceList失败:', err);
        sendResponse({ success: false, error: err.message });
      });

    return true;
  }

  if (request.action === 'getDeviceScreenShot') {
    const { deviceCode } = request;
    const url = `https://vcp.21cn.com/vcpCamera/tag/getDeviceScreenShot?deviceCode=${deviceCode}`;

    vcpFetch(url)
      .then(data => {
        if (data && data.data && (data.data.startsWith('http://') || data.data.startsWith('https://'))) {
          sendResponse({ success: true, imageUrl: data.data });
        } else {
          throw new Error(data.msg || '查询失败，未获取到图片地址');
        }
      })
      .catch(err => {
        console.error('getDeviceScreenShot失败:', err);
        sendResponse({ success: false, error: err.message });
      });

    return true;
  }

  if (request.action === 'saveRegion') {
    const { cusRegionNames, cusRegionId, entUserId: requestEntUserId, isEdit } = request;
    const url = isEdit
      ? 'https://vcp.21cn.com/vcpCamera/cusRegion/editCusRegion'
      : 'https://vcp.21cn.com/vcpCamera/cusRegion/addCusRegion';

    const params = new URLSearchParams();
    if (isEdit) {
      params.append('cusRegionId', cusRegionId);
      params.append('cusRegionName', cusRegionNames);
      params.append('entUserId', requestEntUserId || entUserId || '');
    } else {
      params.append('cusRegionNames', cusRegionNames);
      params.append('cusRegionId', cusRegionId);
      params.append('entUserId', requestEntUserId || entUserId || '');
    }

    vcpGet(url, params)
      .then(result => {
        if (result.code === 0 || result.code === 20000) {
          sendResponse({ success: true, data: result });
        } else {
          sendResponse({ success: false, error: result.msg || '操作失败' });
        }
      })
      .catch(err => {
        console.error('saveRegion失败:', err);
        sendResponse({ success: false, error: err.message });
      });

    return true;
  }

  if (request.action === 'deleteRegion') {
    const { cusRegionIds } = request;
    const params = new URLSearchParams({
      cusRegionIds: cusRegionIds,
      entUserId: entUserId || ''
    });

    vcpGet('https://vcp.21cn.com/vcpCamera/cusRegion/delCusRegion', params)
      .then(result => {
        if (result.code === 0 || result.code === 20000) {
          sendResponse({ success: true, data: result });
        } else {
          sendResponse({ success: false, error: result.msg || '操作失败' });
        }
      })
      .catch(err => {
        console.error('deleteRegion失败:', err);
        sendResponse({ success: false, error: err.message });
      });

    return true;
  }

  if (request.action === 'exportCatalogCodeEmail') {
    const { userId, cusRegionId, email, entUserId: requestEntUserId } = request;
    const params = new URLSearchParams({
      userId: userId,
      cusRegionId: cusRegionId,
      email: email,
      entUserId: requestEntUserId || entUserId || ''
    });

    vcpGet('https://vcp.21cn.com/vcpCamera/cusRegion/exportCatalogCodeEmail', params)
      .then(result => {
        if (result.code === 0 || result.code === 20000) {
          sendResponse({ success: true, data: result });
        } else {
          sendResponse({ success: false, error: result.msg || '导出失败' });
        }
      })
      .catch(err => {
        console.error('exportCatalogCodeEmail失败:', err);
        sendResponse({ success: false, error: err.message });
      });

    return true;
  }
});
