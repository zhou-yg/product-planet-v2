# Base

这是一个用于管理 markdown 文件的工具平台

使用 next.js 开发，使用 tailwindcss 作为样式库

使用 playwright 作为e2e 测试工具

## 结构

requirements
- common/** */.md 
  - 通用的上下文，每次都加载这些
- pages/** */.md 
  - 页面需求的上下文，当需要改动页面时，要使用对应页面的上下文了解信息
- tests/**.md 
  - 测试用例的上下文，包含了对应页面或功能模块的测试用例

products/
- 生成的具体代码

## 关于 e2e

不需要每次都运行e2e，除非明确提到了

## 本地访问与端口

- dev server 固定使用 5 位端口 **41000**（`next dev -p 41000`），避免与其他 Next.js 项目的 3000/3001 冲突
- 通过 nginx 反代，本机可直接以 **http://pp2.com** 访问
- `products/next.config.ts` 已配置 `allowedDevOrigins: ["pp2.com", "127.0.0.1"]`——经非 localhost 域名访问时必须，否则 Next.js dev 拦截 `/_next/hmr` 跨源请求，页面点击交互全部失灵；改动后需重启 dev server
- nginx 站点配置, **仅 pp2.com** 反代到 `http://127.0.0.1:41000`（支持 WebSocket/HMR）；其他域名/Host 打到 80 一律 444 拒绝，不做转发