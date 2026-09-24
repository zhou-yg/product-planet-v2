---
inject:
  - components/md-editor.md
  - components/glb-viewer.md
  - service/file-writer.md
---

# Home - 中间

- 可以根据不同的文件类型，展示不同的编辑器
  - markdown 使用 <md-editor>markdown编辑器</md-editor>
  - 图片类型，不能编辑，只能预览
  - glb类型，使用 <glb-viewer>glb预览器</glb-viewer>
  - 其它待拓展
- 文件内容模块，展示当前选中的文件内容
- 顶部不需要展示文件名
- 提供保存按钮
  - 使用 <file-writer /> 里的写接口 保存最新的文件内容
