/**
 * Outmap Storage Health & Maintenance
 * 离线存储体检与碎片整理面板
 */
(function () {
  'use strict';

  function formatBytes(bytes) {
    if (!bytes || isNaN(bytes) || bytes <= 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return (bytes / Math.pow(1024, i)).toFixed(1) + ' ' + units[i];
  }

  async function openStorageMaintenanceModal() {
    if (!window.electronAPI?.getStorageHealth) {
      window.showToast?.('当前运行在纯浏览器模式，无需本地磁盘碎片体检');
      return;
    }

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay prompt-active storage-maintenance-backdrop';
    overlay.id = 'storage-maintenance-overlay';
    overlay.style.zIndex = '10050'; // 确保位于离线下载主弹窗之上
    overlay.innerHTML = [
      '<div class="modal-card" style="max-width: 480px; width: 92%; margin: auto; background: #ffffff !important; color: #0f172a !important; border: 1px solid rgba(203, 213, 225, 0.9) !important; border-radius: 12px !important; box-shadow: 0 25px 50px -12px rgba(15, 23, 42, 0.4), 0 0 0 1px rgba(15, 23, 42, 0.08) !important; backdrop-filter: none !important; -webkit-backdrop-filter: none !important; animation: popIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);">',
      '  <div class="modal-header" style="border-bottom: 1px solid #f1f5f9; padding: 14px 18px; display: flex; align-items: center; justify-content: space-between;">',
      '    <div class="modal-title" style="font-size: 15px; font-weight: 700; color: #0f172a; display: flex; align-items: center; gap: 8px;">',
      '      <span>🛠️ 离线存储体检与健康维护</span>',
      '    </div>',
      '    <button class="modal-close-btn" id="btn-close-storage-modal" title="关闭" style="color: #64748b; font-size: 16px; cursor: pointer;">✕</button>',
      '  </div>',
      '  <div class="modal-body" id="storage-health-content" style="padding: 16px 18px; font-size: 13px; color: #334155;">',
      '    <div style="text-align:center; padding: 24px 0; color: #64748b;">正在扫描磁盘与 PMTiles 归档健康度...</div>',
      '  </div>',
      '  <div class="modal-footer" style="display:flex; justify-content:flex-end; gap:8px; padding: 12px 18px; border-top: 1px solid #f1f5f9; background: #f8fafc; border-bottom-left-radius: 12px; border-bottom-right-radius: 12px;">',
      '    <button class="modal-btn secondary" id="btn-storage-cancel">关闭</button>',
      '    <button class="modal-btn accent" id="btn-storage-clean" style="display:none; background: #0284c7; color: #fff;">一键无损瘦身</button>',
      '  </div>',
      '</div>'
    ].join('');

    document.body.appendChild(overlay);

    const content = overlay.querySelector('#storage-health-content');
    const btnCloseModal = overlay.querySelector('#btn-close-storage-modal');
    const btnCancel = overlay.querySelector('#btn-storage-cancel');
    const btnClean = overlay.querySelector('#btn-storage-clean');

    const close = (e) => {
      if (e) {
        e.preventDefault?.();
        e.stopPropagation?.();
        e.stopImmediatePropagation?.();
      }
      window.removeEventListener('keydown', handleKeyDown, true);
      overlay.classList.remove('prompt-active');
      overlay.style.opacity = '0';
      overlay.style.transition = 'opacity 0.15s ease';
      setTimeout(() => overlay.remove(), 160);
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        close(e);
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);

    // 关键：点击自身遮罩背景关闭自己，并阻止事件冒泡误关底层离线下载弹窗
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        close(e);
      }
    });

    btnCloseModal?.addEventListener('click', close);
    btnCancel?.addEventListener('click', close);

    try {
      const health = await window.electronAPI.getStorageHealth();
      const hasFragments = (health.fragmentCount || 0) > 0;
      const isDownloading = Boolean(health?.isDownloading);
      let statusTitle = '✅ 存储健康，无孤儿临时碎片';
      let statusColor = '#16a34a';
      let statusBg = '#f0fdf4';
      let statusBorder = '#bbf7d0';
      let statusDesc = '所有离线切片均已封装入 PMTiles 单文件，未发现悬挂临时文件。';

      if (isDownloading) {
        statusTitle = '⚡ 离线下载正在进行中';
        statusColor = '#0284c7';
        statusBg = '#f0f9ff';
        statusBorder = '#bae6fd';
        statusDesc = hasFragments
          ? '检测到 <b>' + health.fragmentCount + '</b> 个正在写入的分块缓存（约 <b>' + formatBytes(health.fragmentBytes) + '</b>）。数据正在流式追加，请等待下载完成后再整理碎片。'
          : '当前离线下载任务正在平稳写入，切片归档正常。';
      } else if (hasFragments) {
        statusTitle = '⚠️ 发现可清理的临时分块碎片';
        statusColor = '#e11d48';
        statusBg = '#fff1f2';
        statusBorder = '#fecdd3';
        statusDesc = '扫描到 <b>' + health.fragmentCount + '</b> 个未完成的历史下载碎片与临时 Spool 文件，占用 <b>' + formatBytes(health.fragmentBytes) + '</b> 空间。';
      }

      content.innerHTML = [
        '<div style="display:grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 14px;">',
        '  <div style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 12px 14px; border-radius: 8px;">',
        '    <div style="color:#64748b; font-size:12px; font-weight:500;">PMTiles 单文件归档</div>',
        '    <div style="color:#0284c7; font-size:22px; font-weight:700; margin: 4px 0 2px 0;">' + (health.archivesCount || 0) + ' <span style="font-size:13px; font-weight:normal; color:#64748b;">个</span></div>',
        '    <div style="color:#475569; font-size:11.5px;">总计 ' + formatBytes(health.archivesBytes || 0) + '</div>',
        '  </div>',
        '  <div style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 12px 14px; border-radius: 8px;">',
        '    <div style="color:#64748b; font-size:12px; font-weight:500;">收录总切片量</div>',
        '    <div style="color:#16a34a; font-size:22px; font-weight:700; margin: 4px 0 2px 0;">' + Number(health.archivesTiles || 0).toLocaleString() + '</div>',
        '    <div style="color:#475569; font-size:11.5px;">单文件直读零碎片</div>',
        '  </div>',
        '</div>',
        '<div style="background:' + statusBg + '; border:1px solid ' + statusBorder + '; border-radius:8px; padding:12px 14px; margin-bottom:4px;">',
        '  <div style="color:' + statusColor + '; font-weight:700; font-size:13px; margin-bottom:4px; display:flex; align-items:center; gap:6px;">',
        '    ' + statusTitle,
        '  </div>',
        '  <div style="color:#334155; font-size:12.5px; line-height:1.55;">',
        '    ' + statusDesc,
        '  </div>',
        '</div>'
      ].join('');

      if (hasFragments) {
        btnClean.style.display = 'inline-block';
        if (isDownloading) {
          btnClean.disabled = true;
          btnClean.style.opacity = '0.55';
          btnClean.style.cursor = 'not-allowed';
          btnClean.title = '离线下载进行中，为避免写入冲突暂不可清理';
          btnClean.innerText = '下载进行中';
        } else {
          btnClean.disabled = false;
          btnClean.style.opacity = '1';
          btnClean.style.cursor = 'pointer';
          btnClean.innerText = '一键无损瘦身';
          btnClean.addEventListener('click', async () => {
            btnClean.disabled = true;
            btnClean.innerText = '正在清理...';
            try {
              const res = await window.electronAPI.cleanStorageFragments();
              if (res.inProgress) {
                window.showToast?.(res.message);
              } else {
                window.showToast?.('成功清理 ' + res.cleanedFiles + ' 个临时碎片，释放 ' + formatBytes(res.reclaimedBytes) + ' 空间！');
              }
              close();
            } catch (e) {
              window.showToast?.('清理失败: ' + e.message);
            }
          });
        }
      }
    } catch (err) {
      content.innerHTML = '<div style="color:#f87171;">扫描存储状态失败: ' + err.message + '</div>';
    }
  }

  if (typeof window !== 'undefined') {
    window.openStorageMaintenanceModal = openStorageMaintenanceModal;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { openStorageMaintenanceModal, formatBytes };
  }
})();
