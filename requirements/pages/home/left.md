---
inject: 
  - components/file-tree-manager.md
---

# Home - 左侧

- 文件树管理器
  - 使用 <file-tree-manager>
- 选中锚点效果，锚定是文件路径
- 点击时记录到 url 里，刷新页面时自动选中
- 顶部增加 workspace 选择器，选择后自动刷新为 workspace 下的 requirements 内部文件树
  - 如果没有 requirements 文件夹，则左侧栏要提示 “缺少 requirements 文件夹”
  - workspace 选择器，应该像是系统选择文件夹一样的交互
  - 选择文件夹后，若该文件夹不在已知 workspace 列表中：
    - 客户端调用 `/api/workspace`（POST，body: `{ name }`）让服务端按文件夹名搜索并注册该 workspace（要求文件夹内含 requirements/）
    - 注册成功后自动切换到该 workspace，左侧目录刷新为新 workspace 的 requirements 文件树
    - 注册失败（找不到同名且含 requirements/ 的文件夹）时提示 “未找到名为「xx」的 workspace（需含 requirements 文件夹）”
