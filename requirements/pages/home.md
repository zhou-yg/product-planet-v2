---
inject:
  - common/base.md
  - components/md-editor.md
  - service/file-writer.md
---

# Home

首页， 左中右

- 左侧
 - 文件树管理器
 - 选中锚点效果，锚定是文件路径
 - 点击时记录到 url 里，刷新页面时自动选中

- 中间
  - 文件内容模块，展示当前选中的文件内容
  - 使用 <md-editor>markdown编辑器</md-editor>
  - 顶部不需要展示文件名
  - 提供保存按钮
    - 使用 <file-writer /> 里的写接口 保存最新的文件内容

- 右侧
  - 如果 markdown 文件且meta 声明 inject: ["依赖"]，
    - 展示文件依赖列表， 仅显示名称和文件路径，可点击跳转

