---
inject:
  - components/md-editor.md
  - components/glb-viewer.md
  - service/file-writer.md
  - service/view-and-diff.md
---

# Home

首页， 左中右

- 左侧
 - 文件树管理器
 - 选中锚点效果，锚定是文件路径
 - 点击时记录到 url 里，刷新页面时自动选中
 - 顶部增加 workspace 选择器，选择后自动刷新为 workspace 下的requirements内部文件树
  - 如果没有 requirements 文件夹，则左侧栏要提示 “缺少 requirements 文件夹“
  - workspace 选择器，应该像是系统选择文件夹一样的交互


- 中间
  - 可以根据不同的文件类型，展示不同的编辑器
    - markdown 使用 <md-editor>markdown编辑器</md-editor>
    - 图片类型，不能编辑，只能预览
    - glb类型，使用 <glb-viewer>glb预览器</glb-viewer>
    - 其它待拓展
  - 文件内容模块，展示当前选中的文件内容
  - 顶部不需要展示文件名
  - 提供保存按钮
    - 使用 <file-writer /> 里的写接口 保存最新的文件内容

- 右侧
  - 1.获取提示词, + 一个“获取“按钮，点击时出弹框，弹框里展示 <view-and-diff> 接口返回的内容
  - 2.如果 markdown 文件且meta 声明 inject: ["依赖"]，
    - 展示文件依赖列表， 仅显示名称和文件路径，可点击跳转
