# Home Left

进入页面时

- 展示requirements 下的文件树
- 如果 url 中包含文件路径，高亮选中的文件


点击文件树中的文件时

- 高亮选中的文件
- 记录选中的文件路径到url


workspace 选择器（系统文件夹选择式交互）

- 顶部展示当前 workspace 名称，点击唤起系统文件夹选择
- 选择文件夹后，若文件夹在已知 workspace 列表中且含 requirements/，自动切换，左侧文件树刷新为新 workspace 的 requirements 文件树，url 记录 `ws` 参数
- 选择文件夹后，若文件夹不在已知 workspace 列表（或已知同名项缺少 requirements/）：
  - 客户端调用 `POST /api/workspace`（body: `{ name }`）让服务端按文件夹名搜索并注册
  - 服务端在 WORKSPACE_PARENT / cwd / ~/Documents / ~/Projects / ~ 等根目录下做有界深度搜索（跳过 node_modules/.git/Library 等），要求目录内含 requirements/
  - 注册状态持久化到临时目录注册文件，跨 worker / 服务重启共享
  - 注册成功后自动切换 workspace，文件树刷新
  - 注册失败时提示「未找到名为「xx」的 workspace（需含 requirements 文件夹）」
- 若所选 workspace 不含 requirements 文件夹，左侧栏提示「缺少 requirements 文件夹」
