# product-planet-v2
产品星球2.0

Markdown 文件管理平台。

## 目录结构

- `requirements/` — 需求文档（markdown 内容库，文件树展示的内容源）
  - `common/*.md` — 通用上下文
  - `pages/*.md` — 页面需求上下文
- `products/` — 全部实现代码（Next.js + Tailwind CSS 应用）

## 开发与构建

所有命令都在 `products/` 目录下执行：

```bash
cd products
npm install
npm run dev    # 开发模式
npm run build  # 生产构建
npm start      # 生产运行
```

应用默认从仓库根目录定位 `requirements/`；如内容库在别的位置，
可用环境变量 `REQUIREMENTS_ROOT=/path/to/requirements` 指定。
