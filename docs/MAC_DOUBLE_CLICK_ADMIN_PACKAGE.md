# Mac 双击版商家后台包说明

本文件说明 Mac 本地演示版后台启动包。

## 文件清单

中文入口：

```text
mac/打开绿膳荟后台.command
mac/停止绿膳荟后台.command
mac/检查后台状态.command
mac/修复后台显示异常.command
```

英文/ASCII 兜底入口：

```text
mac/start-admin-mac.command
mac/stop-admin-mac.command
mac/check-admin-mac.command
mac/repair-admin-mac.command
```

如果压缩包跨平台后中文文件名乱码，优先使用英文入口。

## 路径定位

所有 Mac `.command` 文件都从自身位置自动定位项目根目录，不再硬编码某台电脑的绝对路径。

项目文件夹整体移动后，只要 `mac` 文件夹仍在项目根目录内，双击入口仍可使用。

## 启动方式

双击：

```text
start-admin-mac.command
```

或：

```text
打开绿膳荟后台.command
```

启动成功后访问：

```text
http://127.0.0.1:3001/login
```

## 停止方式

双击：

```text
stop-admin-mac.command
```

或：

```text
停止绿膳荟后台.command
```

## 状态检查

双击：

```text
check-admin-mac.command
```

## 显示异常修复

双击：

```text
repair-admin-mac.command
```

该操作只清理 admin-web 本地页面缓存，不删除数据库、商品、订单、库存、门店、`node_modules` 或 `.local/env`。

## 本地演示版边界

本地演示版需要：

1. Node.js / npm
2. 本地数据库
3. 本地环境配置文件
4. 项目源码

如果缺少任何一项，请联系开发同事。

正式商家版未来应通过 HTTPS 后台网址登录，不需要运行这些脚本。

## Windows 状态

Windows 脚本已生成，但必须在 Windows 真机上完成最终双击验证后，才能作为 Windows 交付通过。
