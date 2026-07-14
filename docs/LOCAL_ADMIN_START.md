# 绿膳荟商家后台本地启动说明

本文档用于 Mac 本地开发和演示环境，帮助开发同事稳定启动商家后台。

## 推荐方式：双击启动

在 Finder 中打开：

```text
项目文件夹/mac/
```

双击：

```text
打开绿膳荟后台.command
```

脚本启动成功后会自动打开：

```text
http://127.0.0.1:3001/login
```

## 终端启动命令

也可以在项目根目录执行：

```bash
cd 项目文件夹
npm run dev:admin-local
```

脚本会自动完成：

1. 读取 `.local/env/wechat-miniapp.local`
2. 设置本地开发管理员环境变量
3. 执行 `npx prisma db push`
4. 执行 `npx prisma db seed`
5. 检查本地管理员账号是否存在
6. 检查 `3000` 和 `3001` 端口
7. 启动 API 服务
8. 启动商家后台
9. 打开后台登录页

## 后台地址

```text
http://127.0.0.1:3001/login
```

## 默认本地开发账号

```text
账号：admin
密码：<legacy-local-password-removed>
```

这个账号只用于本机开发和演示，不是生产账号，不要用于线上环境。

## 停止后台

推荐双击：

```text
mac/停止绿膳荟后台.command
```

或执行：

```bash
npm run stop:admin-local
```

如果是在启动窗口里运行，也可以按：

```text
Ctrl+C
```

## 检查后台状态

推荐双击：

```text
mac/检查后台状态.command
```

或执行：

```bash
npm run check:admin-local
```

检查项包括：

1. API 端口 `3000`
2. admin-web 端口 `3001`
3. 商品接口 `/products`
4. 后台登录接口 `/admin/auth/login`
5. 后台登录页 `/login`
6. 本地管理员账号是否存在

## 修复页面纯 HTML 或样式异常

推荐双击：

```text
mac/修复后台显示异常.command
```

或执行：

```bash
npm run repair:admin-local
```

该操作会：

1. 停止本项目本地后台服务
2. 删除 `apps/admin-web/.next` 本地缓存

不会删除数据库、商品、订单、库存、门店、`node_modules` 或 `.local/env`。

## 常见问题

### API 端口 3000 已被占用

先双击：

```text
停止绿膳荟后台.command
```

如果仍提示被占用，说明可能有旧终端服务还在运行。请截图发给开发同事处理，不要随便关闭不认识的进程。

### admin-web 端口 3001 已被占用

先双击：

```text
停止绿膳荟后台.command
```

如果仍提示被占用，请截图发给开发同事处理，不要随便关闭不认识的进程。

### 找不到本地环境变量文件

脚本需要这个文件：

```text
项目文件夹/.local/env/wechat-miniapp.local
```

这个文件不能提交、不能打包进 review pack，也不要把内容发给别人。

### seed 后没有管理员账号

一键启动脚本会执行 seed 并检查 `AdminUser`。

如果检查失败：

1. 确认本地数据库已启动。
2. 确认 `.local/env/wechat-miniapp.local` 可连接本地数据库。
3. 重新运行 `npm run dev:admin-local`。

### 登录失败

先执行：

```bash
npm run check:admin-local
```

如果商品接口正常但登录接口失败，通常是本地管理员 seed 没有成功，重新运行一键启动脚本即可。

### 登录页显示纯 HTML 或没有样式

常见原因：

1. admin-web dev server 还没完全启动。
2. 浏览器缓存了旧页面。
3. `.next` 本地缓存短暂不一致。

处理方式：

1. 等脚本显示后台已启动后再打开。
2. 浏览器硬刷新：`Command + Shift + R`。
3. 双击 `修复后台显示异常.command`。
4. 再双击 `打开绿膳荟后台.command`。

## 本地数据提醒

本地库可能保留旧测试商品，例如名称包含“新鲜三文鱼”的未发布商品。本阶段不自动删除。

后续清理建议：

1. 只清理未发布商品。
2. 只清理名称明显为测试/演示的数据。
3. 清理前确认没有真实订单引用。
4. 清理动作必须有二次确认。
