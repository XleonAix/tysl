chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('收到消息:', request.action, request);
  
  if (request.action === 'getCookies') {
    chrome.cookies.getAll({ domain: '21cn.com' }, (cookies) => {
      const cookieObj = {};
      cookies.forEach(cookie => {
        cookieObj[cookie.name] = cookie.value;
      });
      console.log('获取到的cookies:', cookieObj);
      console.log('safeVillageCookie:', cookieObj['safeVillageCookie']);
      sendResponse(cookieObj);
    });
    return true;
  }
  
  if (request.action === 'getUserRegionList') {
    const { userId } = request;
    const url = 'https://vcp.21cn.com/vcpCamera/user/getUserRegionList';
    
    const data = new URLSearchParams();
    data.append('userId', userId);
    
    const headers = {
      'Accept': 'application/json, text/plain, */*',
      'Accept-Encoding': 'gzip, deflate, br, zstd',
      'Accept-Language': 'zh-CN,zh;q=0.9',
      'Connection': 'keep-alive',
      'Origin': 'https://vcp.21cn.com',
      'Referer': 'https://vcp.21cn.com/vcpCamera/web/index.html',
      'Sec-Fetch-Dest': 'empty',
      'Sec-Fetch-Mode': 'cors',
      'Sec-Fetch-Site': 'same-origin',
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36',
      'sec-ch-ua': '"Chromium";v="146", "Not-A.Brand";v="24", "Google Chrome";v="146"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': 'macOS',
      'Content-Type': 'application/x-www-form-urlencoded'
    };
    
    console.log('========== 请求详情 ==========');
    console.log('URL:', url);
    console.log('Method: POST');
    console.log('Headers:', JSON.stringify(headers, null, 2));
    console.log('Body:', data.toString());
    console.log('==============================');
    
    fetch(url, {
      method: 'POST',
      headers: headers,
      body: data,
      credentials: 'include'
    })
    .then(response => {
      console.log('========== 响应详情 ==========');
      console.log('状态码:', response.status);
      console.log('状态文本:', response.statusText);
      console.log('响应头:', Object.fromEntries(response.headers.entries()));
      return response.text();
    })
    .then(text => {
      console.log('响应原始文本:', text);
      try {
        const result = JSON.parse(text);
        console.log('解析后的JSON:', result);
        if (result.code === 0 && result.data && result.data.length > 0) {
          console.log('成功获取区域代码:', result.data[0].regionCode);
          sendResponse({ success: true, regionCode: result.data[0].regionCode });
        } else {
          console.log('API返回错误:', result);
          sendResponse({ success: false, error: result.msg || '用户未登录，请登录！' });
        }
      } catch (e) {
        console.error('JSON解析失败:', e);
        sendResponse({ success: false, error: 'JSON解析失败: ' + e.message });
      }
      console.log('==============================');
    })
    .catch(err => {
      console.error('========== 请求失败 ==========');
      console.error('错误信息:', err);
      console.error('错误堆栈:', err.stack);
      console.error('==============================');
      sendResponse({ success: false, error: err.message });
    });
    
    return true;
  }
});

chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ windowId: tab.windowId });
});
