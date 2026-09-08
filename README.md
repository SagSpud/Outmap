# Outmap (3D Outdoor GIS & Map Service)

> 极致流畅、沉浸式全国 3D 地形与高精度户外等高线地图系统。支持桌面 Electron 客户端与 Cloudflare Serverless 纯 Web 浏览器双模式运行。

## ✨ 特性亮点

- **🏔️ 真实高程 3D 地形与等高线**：集成全球高精度 DEM 与 MapLibre Contour 实时动态等高线，立体展现山川丘陵起伏。
- **🛰️ 混合图层切换**：支持户外矢量地图、高清卫星影像、地形坡度阴影随时一键自由切换。
- **🌐 纯 Web 零服务器架构**：支持直接托管在 Cloudflare Pages，0 台服务器，依靠浏览器 WebGL 本地渲染，全球极速访问。
- **💻 桌面客户端深度支持**：支持全国分省离线金字塔切片管理与秒级漫游同步。
- **🎯 黄金 50° 俯仰角与中国全景边界约束**：出厂预设沉浸式 50 度视角，全自动边界阻尼约束。

## 🚀 目录结构

- `src/`：纯静态 Web 与客户端共用源码（`index.html`、`style.css`、`app.js`、`vendor/`、`china-boundary.json`）
- `scripts/`：自动化打包、切片管理与 Cloudflare 同步脚本
- `main.js` / `preload.js`：Electron 桌面客户端主进程与 IPC 通信

## 🛠️ Cloudflare Pages 部署说明

1. Framework preset（框架预设）：**`None`**
2. Build command（构建命令）：**留空**
3. Build output directory（构建输出目录）：**`src`**
