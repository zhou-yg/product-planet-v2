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