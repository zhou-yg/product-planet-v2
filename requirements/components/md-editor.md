# markdown-editor

使用 mdxeditor 实现（这个开源组件)

渲染时，文档的第一个 # 作为标题，后面的内容作为正文编辑

最终保存时，将标题和正文合并为一个 markdown 文档，保存到文件中

渲染时：
  - markdown 之间有空行的，渲染时也要保留个适当的间隔

快捷键支持：
  - cmd + s 快捷，触发保存

注意实现：

  - 如果markdown文档存在 meta 信息，需要保留