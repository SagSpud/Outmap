/**
 * Outmap 3D Aerial Route Flythrough Simulation Engine
 * 3D 路线低空航拍漫游模拟器
 */
(function () {
  'use strict';

  function calculateBearing(p1, p2) {
    const rad = Math.PI / 180;
    const y = Math.sin((p2[0] - p1[0]) * rad) * Math.cos(p2[1] * rad);
    const x = Math.cos(p1[1] * rad) * Math.sin(p2[1] * rad) -
              Math.sin(p1[1] * rad) * Math.cos(p2[1] * rad) * Math.cos((p2[0] - p1[0]) * rad);
    return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
  }

  function haversineDistance(c1, c2) {
    const R = 6371; // km
    const rad = Math.PI / 180;
    const dLat = (c2[1] - c1[1]) * rad;
    const dLng = (c2[0] - c1[0]) * rad;
    const a = Math.sin(dLat / 2) ** 2 +
              Math.cos(c1[1] * rad) * Math.cos(c2[1] * rad) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  function lerpAngle(a, b, t) {
    let diff = (b - a) % 360;
    if (diff < -180) diff += 360;
    if (diff > 180) diff -= 360;
    return (a + diff * t + 360) % 360;
  }

  class RouteSimulator {
    constructor(map, options = {}) {
      this.map = map;
      this.options = options;
      this.pathCoords = [];
      this.segmentDistances = [];
      this.totalDistKm = 0;
      this.currentDistKm = 0;
      this.isPlaying = false;
      this.speedMultiplier = 1;
      this.baseSpeedKmh = 140; // 航拍巡航基准时速 140 km/h
      this.currentBearing = 0;
      this.rafId = null;
      this.lastFrameTime = 0;
      this.onProgressCallback = null;
      this.onStopCallback = null;
      this.savedCameraState = null;
      this.controlOverlay = null;
    }

    loadRoute(coords) {
      this.stop(false);
      if (!Array.isArray(coords) || coords.length < 2) return false;
      this.pathCoords = coords.map(c => [Number(c[0]), Number(c[1])]);
      this.segmentDistances = [0];
      this.totalDistKm = 0;
      for (let i = 1; i < this.pathCoords.length; i++) {
        const d = haversineDistance(this.pathCoords[i - 1], this.pathCoords[i]);
        this.totalDistKm += d;
        this.segmentDistances.push(this.totalDistKm);
      }
      this.currentDistKm = 0;
      this.currentBearing = calculateBearing(this.pathCoords[0], this.pathCoords[1]);
      return true;
    }

    start() {
      if (this.pathCoords.length < 2) return;
      if (!this.savedCameraState && this.map) {
        this.savedCameraState = {
          center: this.map.getCenter(),
          zoom: this.map.getZoom(),
          pitch: this.map.getPitch(),
          bearing: this.map.getBearing()
        };
      }
      this.isPlaying = true;
      this.lastFrameTime = performance.now();
      this.renderControlBar();
      this.tick();
    }

    pause() {
      this.isPlaying = false;
      if (this.rafId) {
        cancelAnimationFrame(this.rafId);
        this.rafId = null;
      }
      this.updateControlBarUI();
    }

    resume() {
      if (this.currentDistKm >= this.totalDistKm) {
        this.currentDistKm = 0;
      }
      this.isPlaying = true;
      this.lastFrameTime = performance.now();
      this.updateControlBarUI();
      this.tick();
    }

    togglePlay() {
      if (this.isPlaying) this.pause();
      else this.resume();
    }

    stop(restoreCamera = true) {
      this.isPlaying = false;
      if (this.rafId) {
        cancelAnimationFrame(this.rafId);
        this.rafId = null;
      }
      if (this.controlOverlay) {
        this.controlOverlay.remove();
        this.controlOverlay = null;
      }
      if (restoreCamera && this.savedCameraState && this.map) {
        try {
          this.map.easeTo({
            center: this.savedCameraState.center,
            zoom: this.savedCameraState.zoom,
            pitch: this.savedCameraState.pitch,
            bearing: this.savedCameraState.bearing,
            duration: 600
          });
        } catch (_) {}
      }
      this.savedCameraState = null;
      this.onStopCallback?.();
    }

    seek(ratio) {
      const clamped = Math.max(0, Math.min(1, ratio));
      this.currentDistKm = clamped * this.totalDistKm;
      this.updateCameraToCurrentDist();
      this.updateControlBarUI();
    }

    setSpeed(speed) {
      this.speedMultiplier = speed;
      this.updateControlBarUI();
    }

    cycleSpeed() {
      const speeds = [1, 2, 4, 8];
      const idx = speeds.indexOf(this.speedMultiplier);
      const next = speeds[(idx + 1) % speeds.length];
      this.setSpeed(next);
    }

    getPositionAtDist(distKm) {
      const clamped = Math.max(0, Math.min(this.totalDistKm, distKm));
      let idx = 1;
      while (idx < this.segmentDistances.length && this.segmentDistances[idx] < clamped) {
        idx++;
      }
      if (idx >= this.pathCoords.length) idx = this.pathCoords.length - 1;
      const prevDist = this.segmentDistances[idx - 1] || 0;
      const nextDist = this.segmentDistances[idx] || 0;
      const segLen = Math.max(1e-6, nextDist - prevDist);
      const t = Math.max(0, Math.min(1, (clamped - prevDist) / segLen));

      const p0 = this.pathCoords[idx - 1];
      const p1 = this.pathCoords[idx];
      const lng = p0[0] + (p1[0] - p0[0]) * t;
      const lat = p0[1] + (p1[1] - p0[1]) * t;
      const targetBearing = calculateBearing(p0, p1);
      return { pos: [lng, lat], targetBearing };
    }

    updateCameraToCurrentDist() {
      if (!this.map) return;
      const { pos, targetBearing } = this.getPositionAtDist(this.currentDistKm);
      this.currentBearing = lerpAngle(this.currentBearing, targetBearing, 0.14);
      this.map.jumpTo({
        center: pos,
        zoom: 13.8,
        pitch: 60,
        bearing: this.currentBearing
      });
      this.onProgressCallback?.(this.currentDistKm, this.totalDistKm, this.currentDistKm / (this.totalDistKm || 1));
    }

    tick() {
      if (!this.isPlaying) return;
      const now = performance.now();
      const dtSec = Math.min(0.1, (now - this.lastFrameTime) / 1000);
      this.lastFrameTime = now;

      const speedKmPerSec = (this.baseSpeedKmh * this.speedMultiplier) / 3600;
      this.currentDistKm += speedKmPerSec * dtSec;

      if (this.currentDistKm >= this.totalDistKm) {
        this.currentDistKm = this.totalDistKm;
        this.updateCameraToCurrentDist();
        this.pause();
        return;
      }

      this.updateCameraToCurrentDist();
      this.updateControlBarUI();
      this.rafId = requestAnimationFrame(() => this.tick());
    }

    renderControlBar() {
      if (this.controlOverlay) this.controlOverlay.remove();
      const bar = document.createElement('div');
      bar.className = 'route-sim-bar';
      bar.id = 'route-sim-bar';
      bar.innerHTML = [
        '<div class="route-sim-inner">',
        '  <button class="route-sim-btn" id="sim-btn-play" title="播放/暂停">',
        '    <span id="sim-icon-play">▶</span>',
        '    <span id="sim-icon-pause" style="display:none;">❚❚</span>',
        '  </button>',
        '  <div class="route-sim-track-wrapper">',
        '    <div class="route-sim-label-row">',
        '      <span class="route-sim-title">🚁 3D 路线低空漫游</span>',
        '      <span class="route-sim-progress-txt" id="sim-progress-txt">0.0 / 0.0 km</span>',
        '    </div>',
        '    <input type="range" class="route-sim-slider" id="sim-slider" min="0" max="1000" value="0" step="1" />',
        '  </div>',
        '  <button class="route-sim-speed-btn" id="sim-btn-speed" title="倍速切换">1x</button>',
        '  <button class="route-sim-close-btn" id="sim-btn-close" title="退出漫游">✕</button>',
        '</div>'
      ].join('');

      document.body.appendChild(bar);
      this.controlOverlay = bar;

      const btnPlay = bar.querySelector('#sim-btn-play');
      const btnSpeed = bar.querySelector('#sim-btn-speed');
      const btnClose = bar.querySelector('#sim-btn-close');
      const slider = bar.querySelector('#sim-slider');

      btnPlay?.addEventListener('click', () => this.togglePlay());
      btnSpeed?.addEventListener('click', () => this.cycleSpeed());
      btnClose?.addEventListener('click', () => this.stop(true));
      slider?.addEventListener('input', e => {
        const ratio = Number(e.target.value) / 1000;
        this.seek(ratio);
      });

      this.updateControlBarUI();
    }

    updateControlBarUI() {
      if (!this.controlOverlay) return;
      const playIcon = this.controlOverlay.querySelector('#sim-icon-play');
      const pauseIcon = this.controlOverlay.querySelector('#sim-icon-pause');
      const progressTxt = this.controlOverlay.querySelector('#sim-progress-txt');
      const speedBtn = this.controlOverlay.querySelector('#sim-btn-speed');
      const slider = this.controlOverlay.querySelector('#sim-slider');

      if (playIcon && pauseIcon) {
        playIcon.style.display = this.isPlaying ? 'none' : 'inline';
        pauseIcon.style.display = this.isPlaying ? 'inline' : 'none';
      }
      if (progressTxt) {
        const pct = Math.round((this.currentDistKm / (this.totalDistKm || 1)) * 100);
        progressTxt.innerText = `${this.currentDistKm.toFixed(1)} / ${this.totalDistKm.toFixed(1)} km (${pct}%)`;
      }
      if (speedBtn) {
        speedBtn.innerText = `${this.speedMultiplier}x`;
      }
      if (slider && !slider.matches(':active')) {
        const ratio = this.totalDistKm > 0 ? this.currentDistKm / this.totalDistKm : 0;
        slider.value = Math.round(ratio * 1000);
      }
    }
  }

  if (typeof window !== 'undefined') {
    window.RouteSimulator = RouteSimulator;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { RouteSimulator, calculateBearing, haversineDistance, lerpAngle };
  }
})();
