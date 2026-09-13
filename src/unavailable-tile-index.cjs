'use strict';

const fs = require('fs');
const path = require('path');

const INDEX_VERSION = 1;
const LAYERS = ['dem', 'vector'];

function normalizeRanges(value) {
  const source = Array.isArray(value) ? value : [];
  const ranges = source
    .map(range => Array.isArray(range) ? [Number(range[0]), Number(range[1])] : null)
    .filter(range => range && Number.isInteger(range[0]) && Number.isInteger(range[1]) && range[0] >= 0 && range[1] >= range[0])
    .sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const merged = [];
  for (const [start, end] of ranges) {
    const previous = merged[merged.length - 1];
    if (previous && start <= previous[1] + 1) previous[1] = Math.max(previous[1], end);
    else merged.push([start, end]);
  }
  return merged;
}

function mergeValues(ranges, values) {
  if (!values || values.size === 0) return ranges;
  const additions = [...values].sort((a, b) => a - b).map(value => [value, value]);
  return normalizeRanges([...ranges, ...additions]);
}

function containsY(ranges, y) {
  let low = 0;
  let high = ranges.length - 1;
  while (low <= high) {
    const middle = (low + high) >> 1;
    const range = ranges[middle];
    if (y < range[0]) high = middle - 1;
    else if (y > range[1]) low = middle + 1;
    else return true;
  }
  return false;
}

class UnavailableTileIndex {
  constructor(filePath, sourceIds = {}) {
    this.filePath = filePath;
    this.sourceIds = { dem: String(sourceIds.dem || ''), vector: String(sourceIds.vector || '') };
    this.columns = { dem: new Map(), vector: new Map() };
    this.pending = { dem: new Map(), vector: new Map() };
    this.dirty = false;
    this.load();
  }

  load() {
    let parsed;
    try {
      parsed = JSON.parse(fs.readFileSync(this.filePath, 'utf8'));
    } catch (error) {
      if (error.code !== 'ENOENT') console.warn('[Unavailable Tile Index]', error.message);
      return;
    }
    if (parsed?.version !== INDEX_VERSION) return;
    for (const layer of LAYERS) {
      // A different upstream dataset gets a clean slate automatically, so a
      // newly published source can fill holes from an older source safely.
      if (String(parsed.sources?.[layer] || '') !== this.sourceIds[layer]) continue;
      const sourceColumns = parsed.columns?.[layer];
      if (!sourceColumns || typeof sourceColumns !== 'object') continue;
      for (const [key, value] of Object.entries(sourceColumns)) {
        if (!/^\d+\/\d+$/.test(key)) continue;
        const ranges = normalizeRanges(value);
        if (ranges.length > 0) this.columns[layer].set(key, ranges);
      }
    }
  }

  columnKey(z, x) {
    return `${Number(z)}/${Number(x)}`;
  }

  has(layer, z, x, y) {
    if (!LAYERS.includes(layer) || !Number.isInteger(Number(y))) return false;
    const key = this.columnKey(z, x);
    if (this.pending[layer].get(key)?.has(Number(y))) return true;
    return containsY(this.columns[layer].get(key) || [], Number(y));
  }

  add(layer, z, x, y) {
    const numericY = Number(y);
    if (!LAYERS.includes(layer) || !Number.isInteger(numericY) || numericY < 0 || this.has(layer, z, x, numericY)) return false;
    const key = this.columnKey(z, x);
    let values = this.pending[layer].get(key);
    if (!values) {
      values = new Set();
      this.pending[layer].set(key, values);
    }
    values.add(numericY);
    this.dirty = true;
    return true;
  }

  remove(layer, z, x, y) {
    const numericY = Number(y);
    if (!LAYERS.includes(layer) || !Number.isInteger(numericY) || numericY < 0) return false;
    const key = this.columnKey(z, x);
    let changed = this.pending[layer].get(key)?.delete(numericY) || false;
    const ranges = this.columns[layer].get(key) || [];
    if (containsY(ranges, numericY)) {
      const next = [];
      for (const [start, end] of ranges) {
        if (numericY < start || numericY > end) next.push([start, end]);
        else {
          if (start < numericY) next.push([start, numericY - 1]);
          if (numericY < end) next.push([numericY + 1, end]);
        }
      }
      if (next.length > 0) this.columns[layer].set(key, next);
      else this.columns[layer].delete(key);
      changed = true;
    }
    if (changed) this.dirty = true;
    return changed;
  }

  forEachRange(callback) {
    for (const layer of LAYERS) {
      const keys = new Set([...this.columns[layer].keys(), ...this.pending[layer].keys()]);
      for (const key of keys) {
        const [z, x] = key.split('/').map(Number);
        const ranges = mergeValues(this.columns[layer].get(key) || [], this.pending[layer].get(key));
        for (const [startY, endY] of ranges) callback(layer, z, x, startY, endY);
      }
    }
  }

  toJSON() {
    const columns = { dem: {}, vector: {} };
    for (const layer of LAYERS) {
      const keys = new Set([...this.columns[layer].keys(), ...this.pending[layer].keys()]);
      for (const key of keys) {
        const ranges = mergeValues(this.columns[layer].get(key) || [], this.pending[layer].get(key));
        if (ranges.length > 0) columns[layer][key] = ranges;
      }
    }
    return { version: INDEX_VERSION, sources: this.sourceIds, columns };
  }

  async save() {
    if (!this.dirty) return false;
    const data = this.toJSON();
    await fs.promises.mkdir(path.dirname(this.filePath), { recursive: true });
    const tempPath = `${this.filePath}.${process.pid}.${Date.now()}.tmp`;
    try {
      await fs.promises.writeFile(tempPath, JSON.stringify(data), 'utf8');
      try {
        await fs.promises.rename(tempPath, this.filePath);
      } catch (error) {
        if (!['EEXIST', 'EPERM'].includes(error.code)) throw error;
        await fs.promises.copyFile(tempPath, this.filePath);
        await fs.promises.rm(tempPath, { force: true });
      }
    } catch (error) {
      await fs.promises.rm(tempPath, { force: true }).catch(() => {});
      throw error;
    }
    for (const layer of LAYERS) {
      for (const [key, values] of this.pending[layer]) {
        this.columns[layer].set(key, mergeValues(this.columns[layer].get(key) || [], values));
      }
      this.pending[layer].clear();
    }
    this.dirty = false;
    return true;
  }
}

module.exports = { INDEX_VERSION, UnavailableTileIndex, normalizeRanges };
