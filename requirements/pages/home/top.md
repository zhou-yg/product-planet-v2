# Top

顶部标题栏

- 左侧：产品标题「产品星球 2.0」
- 右侧：操作区，当前包含「VSCode打开」按钮
  - 点击后调用 `POST /api/workspace/open-vscode`，服务端使用 `code` CLI 打开当前激活的 workspace 目录
