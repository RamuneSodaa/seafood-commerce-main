# Windows 本地启动绿膳荟商家后台

本文档用于 Windows 本地开发和演示环境。

Windows 脚本已生成，但必须在 Windows 真机上完成最终双击验证后，才能作为 Windows 交付通过。

## 推荐方式：双击启动

在文件资源管理器里打开项目内：

```text
windows
```

推荐双击英文/ASCII 兜底入口：

```text
start-admin-windows.bat
```

也可以双击中文入口：

```text
打开绿膳荟后台.bat
```

启动成功后浏览器会打开：

```text
http://127.0.0.1:3001/login
```

## 后台本地账号

```text
账号：admin
密码：<legacy-local-password-removed>
```

这是本地开发账号，不是生产账号，不要用于线上环境。

## 四个英文兜底入口

```text
start-admin-windows.bat
stop-admin-windows.bat
check-admin-windows.bat
repair-admin-windows.bat
```

## 四个中文入口

```text
打开绿膳荟后台.bat
停止绿膳荟后台.bat
检查后台状态.bat
修复后台显示异常.bat
```

## 启动脚本会做什么

1. 读取 `.local\env\wechat-miniapp.local`
2. 设置本地开发管理员变量
3. 同步本地数据库结构
4. 写入本地种子数据
5. 检查本地管理员账号
6. 检查 `3000` 和 `3001` 端口
7. 启动 API 服务
8. 启动商家后台
9. 打开后台登录页

## 端口被占用

如果提示 `3000` 或 `3001` 被占用：

1. 先双击停止后台。
2. 再双击打开后台。
3. 如果仍不行，请截图发给开发同事。

不要随便关闭不认识的程序。

## 页面显示纯文字或没有样式

双击：

```text
repair-admin-windows.bat
```

或：

```text
修复后台显示异常.bat
```

它只会停止本地后台并删除 admin-web 本地缓存。

不会删除数据库、商品、订单、库存、门店、`node_modules` 或 `.local\env`。

## 本地演示版和正式商家版

本地演示版需要 Node.js、npm、本地数据库、本地环境配置文件和项目源码。

正式上线后，商家不需要运行这些脚本，也不需要安装 Node.js、npm 或数据库，只需要打开正式后台网址登录。
