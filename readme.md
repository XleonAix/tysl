# 天翼视联助手 Chrome 插件

一款专为天翼视联平台（vcp.21cn.com）用户设计的 Chrome 浏览器插件，提供批量级联、设备查询、画质监测等实用功能，大幅提升设备管理效率。

## 功能特性

### 1. 用户信息（侧边栏首页）
- 自动读取当前 VCP 页面登录信息
- 显示用户 ID（userId）、手机号（account）
- 一键刷新当前页面数据

### 2. 批量级联
- 支持手动输入设备编码（每行一个）
- 支持上传 CSV 文件批量导入
- 提供 CSV 模板下载
- 批量发送级联请求（batchSize = 80）
- 实时显示处理进度
- 导出级联结果清单（CSV）
- 支持中途停止操作

### 3. 设备在线状态查询
- 支持手动输入设备编码
- 支持上传 CSV 文件批量导入
- 批量查询设备在线状态
- 导出查询结果（CSV）

### 4. 设备清单查询
- 输入手机号获取企业主列表
- 选择企业主后分页查询全部设备
- 表格展示设备信息（序号、设备名称、设备编码、设备型号、目录）
- 支持导出设备清单（CSV）
- 显示查询进度，支持中途停止

### 5. 画质监测
- 输入设备编码查询设备截图
- 点击图片放大查看
- 支持关闭放大窗口（点击 × 按钮或背景区域）

### 6. 监控目录调整
- 查询客户列表和区域目录树
- 支持动态加载子目录
- 选择目标目录后执行调整操作

## 安装方法

1. 打开 Chrome，访问 `chrome://extensions/`
2. 开启右上角 **开发者模式**
3. 点击 **加载已解压的扩展程序**
4. 选择本插件所在目录
5. 点击浏览器工具栏右侧的插件图标，或通过**边栏**打开使用

## 使用前提

- 仅适用于 **https://vcp.21cn.com/** 域名下的页面
- 使用前需先在 VCP 平台登录账号

## 项目结构

```
tysl/
├── manifest.json       # 插件配置文件
├── sidepanel.html     # 侧边栏主页面
├── popup.js           # 侧边栏业务逻辑（含所有功能模块）
├── content.js         # 内容脚本（注入 VCP 页面，执行 API 请求）
├── background.js      # 后台服务脚本
├── floating-window.js # 浮窗功能（预留）
└── icons/             # 插件图标
```

## 核心模块说明

### popup.js 主要函数

| 函数 | 功能 |
|------|------|
| `fetchData()` | 获取当前页面用户信息 |
| `autoFillUserId()` | 自动填充用户 ID |
| `getCustomList()` | 获取客户列表（企业主筛选） |
| `getUserRegionList()` | 获取用户区域代码 |
| `getLevelCusRegion()` | 获取监控目录树 |
| `createCascadeTask()` | 批量执行级联任务 |
| `queryDeviceStatus()` | 查询设备在线状态 |
| `queryDeviceList()` | 查询设备清单 |
| `queryQuality()` | 查询设备画质截图 |
| `exportToCSV()` | 通用 CSV 导出函数 |
| `ensureVcpTab()` | 统一 VCP 标签页验证与脚本注入 |
| `sendVcpMessage()` | 统一消息发送到 content.js |

### content.js 主要 action

| action | 功能 |
|--------|------|
| `getUserInfo` | 获取当前登录用户信息 |
| `getCustomList` | 获取客户列表 |
| `getUserRegionList` | 获取用户区域列表 |
| `getLevelCusRegion` | 获取监控目录树 |
| `getRegionsByDevTreeType` | 批量获取设备信息 |
| `createCascadeTask` | 批量创建级联任务 |
| `getDeviceOnlineStatus` | 批量查询设备在线状态 |
| `getDeviceScreenShot` | 获取设备截图 |
| `setSelectedRegion` | 设置当前选中区域 |

### 公共请求函数（content.js）

```javascript
vcpFetch(url, options)  // 统一 fetch 封装（含登录检测）
vcpGet(url, params)     // GET 请求
vcpPost(url, data, contentType)  // POST 请求
```

## 版本历史

- **v3.0.1** - 优化级联请求逻辑，添加 regionCode 参数；优化画质监测图片放大功能
- **v3.0.0** - 重构代码结构，添加侧边栏支持；提取公共工具函数减少冗余
- **v2.0.0** - 添加批量级联和批量设备查询功能
- **v1.0.0** - 初始版本，实现基本用户信息展示

## 开发者

- **乐山云中台梁勇**
- 持续更新和维护中

## 许可证

MIT License
