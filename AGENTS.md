# AGENTS.md — product-planet-v2（产品星球 2.0）

## 项目需求

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