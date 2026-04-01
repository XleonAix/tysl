async function processCSVFile(file) {
  try {
    const result = await readCSVFile(file);
    console.log('CSV文件处理完成:', result);
    
    // 显示上传统计信息
    const uploadStatsHtml = `
      <table class="data-table" style="margin-top: 5px; width: 100%; border-collapse: collapse;">
        <tr style="background: #e9ecef; border-bottom: 1px solid #dee2e6;">
          <th style="padding: 8px; text-align: left; border: 1px solid #dee2e6;">总上传条数</th>
          <th style="padding: 8px; text-align: left; border: 1px solid #dee2e6;">重复条数</th>
          <th style="padding: 8px; text-align: left; border: 1px solid #dee2e6;">有效条数</th>
        </tr>
        <tr style="border-bottom: 1px solid #dee2e6;">
          <td style="padding: 8px; border: 1px solid #dee2e6;">${result.totalUpload}</td>
          <td style="padding: 8px; border: 1px solid #dee2e6; color: #c5221f;">${result.duplicateCount}</td>
          <td style="padding: 8px; border: 1px solid #dee2e6; color: #137333;">${result.validCount}</td>
        </tr>
      </table>
      <button id="reuploadBtn" style="margin-top: 10px; width: 100%; background: #4285f4; color: white; border: none; padding: 8px; border-radius: 4px; cursor: pointer; font-size: 12px; font-weight: 500;">🔄 重新上传</button>
    `;
    
    document.getElementById('uploadStats').style.display = 'block';
    document.getElementById('uploadStatsContent').innerHTML = uploadStatsHtml;
    
    // 隐藏输入和上传文件的控件及其标签和背景条
    const deviceCodesGroup = document.getElementById('deviceCodes').closest('.input-group');
    if (deviceCodesGroup) {
      deviceCodesGroup.style.display = 'none';
    }
    
    const uploadFileGroup = document.getElementById('dropZone').closest('.input-group');
    if (uploadFileGroup) {
      uploadFileGroup.style.display = 'none';
    }
    
    // 添加重新上传按钮的事件监听
    document.getElementById('reuploadBtn').addEventListener('click', () => {
      // 显示输入和上传文件的控件
      deviceCodesGroup.style.display = 'block';
      uploadFileGroup.style.display = 'block';
      
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