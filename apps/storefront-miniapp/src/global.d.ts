declare module '*.scss';
// Phase 2.49L-a：图片资产模块类型声明（Taro/webpack 实际以 url 解析；此声明仅供 tsc 类型检查识别）。
declare module '*.png' {
  const src: string;
  export default src;
}
declare module '*.jpg' {
  const src: string;
  export default src;
}
declare module '*.jpeg' {
  const src: string;
  export default src;
}
declare module '*.webp' {
  const src: string;
  export default src;
}
declare module '*.svg' {
  const src: string;
  export default src;
}
