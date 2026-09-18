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
    overlay.className = 'modal-overlay prompt-active';
    overlay.id = 'storage-maintenance-overlay';
    overlay.style.zIndex = '10050'; // 确保位于离线下载主弹窗之上
    overlay.innerHTML = [
      '<div class="modal-card" style="max-width: 480px; width: 92%; margin: auto; animation: popIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);">',
      '  <div class="modal-header">',
      '    <div class="modal-title">',
      '      <span>🛠️ 离线存储体检与健康维护</span>',
      '    </div>',
      '    <button class="modal-close-btn" id="btn-close-storage-modal" title="关闭">✕</button>',
      '  </div>',
      '  <div class="modal-body" id="storage-health-content" style="padding: 14px 16px; font-size: 13px;">',
      '    <div style="text-align:center; padding: 24px 0; color: #94a3b8;">正在扫描磁盘与 PMTiles 归档健康度...</div>',
      '  </div>',
      '  <div class="modal-footer" style="display:flex; justify-content:flex-end; gap:8px; padding: 12px 16px;">',
      '    <button class="modal-btn secondary" id="btn-storage-cancel">关闭</button>',
      '    <button class="modal-btn accent" id="btn-storage-clean" style="display:none;">一键无损瘦身</button>',
      '  </div>',
      '</div>'
    ].join('');

    document.body.appendChild(overlay);

    const content = overlay.querySelector('#storage-health-content');
    const btnCloseModal = overlay.querySelector('#btn-close-storage-modal');
    const btnCancel = overlay.querySelector('#btn-storage-cancel');
    const btnClean = overlay.querySelector('#btn-storage-clean');

    const close = (e) => {
      if (e) e.stopPropagation();
      window.removeEventListener('keydown', handleKeyDown);
      overlay.classList.remove('prompt-active');
      overlay.style.opacity = '0';
      overlay.style.transition = 'opacity 0.15s ease';
      setTimeout(() => overlay.remove(), 160);
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') close(e);
    };
    window.addEventListener('keydown', handleKeyDown);

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

      content.innerHTML = [
        '<div style="display:grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 12px;">',
        '  <div style="background:rgba(255,255,255,0.05); padding:10px; border-radius:8px;">',
        '    <div style="color:#64748b; font-size:12px;">PMTiles 单文件归档</div>',
        '    <div style="color:#38bdf8; font-size:18px; font-weight:bold; margin-top:4px;">' + (health.archivesCount || 0) + ' 个</div>',
        '    <div style="color:#94a3b8; font-size:12px;">总计 ' + formatBytes(health.archivesBytes || 0) + '</div>',
        '  </div>',
        '  <div style="background:rgba(255,255,255,0.05); padding:10px; border-radius:8px;">',
        '    <div style="color:#64748b; font-size:12px;">收录总切片量</div>',
        '    <div style="color:#4ade80; font-size:18px; font-weight:bold; margin-top:4px;">' + Number(health.archivesTiles || 0).toLocaleString() + '</div>',
        '    <div style="color:#94a3b8; font-size:12px;">单文件直读零碎片</div>',
        '  </div>',
        '</div>',
        '<div style="background:' + (hasFragments ? 'rgba(239,68,68,0.1)' : 'rgba(34,197,94,0.1)') + '; border:1px solid ' + (hasFragments ? 'rgba(239,68,68,0.25)' : 'rgba(34,197,94,0.25)') + '; border-radius:8px; padding:10px 12px; margin-bottom:8px;">',
        '  <div style="color:' + (hasFragments ? '#f87171' : '#4ade80') + '; font-weight:bold; margin-bottom:4px;">',
        '    ' + (hasFragments ? '⚠️ 发现可清理的临时分块碎片' : '✅ 存储健康，无孤儿临时碎片'),
        '  </div>',
        '  <div style="color:#cbd5e1; font-size:12px;">',
        '    ' + (hasFragments ? ('扫描到 ' + health.fragmentCount + ' 个未完成的下载碎片与临时 Spool 文件，占用 ' + formatBytes(health.fragmentBytes) + ' 空间。') : '所有离线切片均已封装入 PMTiles 单文件，未发现悬挂临时文件。'),
        '  </div>',
        '</div>'
      ].join('');

      if (hasFragments) {
        btnClean.style.display = 'inline-block';
        btnClean.addEventListener('click', async () => {
          btnClean.disabled = true;
          btnClean.innerText = '正在清理...';
          try {
            const res = await window.electronAPI.cleanStorageFragments();
            window.showToast?.('成功清理 ' + res.cleanedFiles + ' 个临时碎片，释放 ' + formatBytes(res.reclaimedBytes) + ' 空间！');
            close();
          } catch (e) {
            window.showToast?.('清理失败: ' + e.message);
          }
        });
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
