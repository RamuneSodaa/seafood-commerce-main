# Windows 双击版商家后台包说明

Windows 脚本已生成，但必须在 Windows 真机上完成最终双击验证后，才能作为 Windows 交付通过。

## 文件清单

中文入口：

```text
windows/打开绿膳荟后台.bat
windows/停止绿膳荟后台.bat
windows/检查后台状态.bat
windows/修复后台显示异常.bat
```

英文/ASCII 兜底入口：

```text
windows/start-admin-windows.bat
windows/stop-admin-windows.bat
windows/check-admin-windows.bat
windows/repair-admin-windows.bat
```

PowerShell 核心脚本：

```text
scripts/start-admin-local.ps1
scripts/stop-admin-local.ps1
scripts/check-admin-local.ps1
scripts/repair-admin-local.ps1
```

如果压缩包跨平台后中文文件名乱码，优先使用英文入口。

## 本地启动范围

Windows 本地演示版会：

1. 读取 `.local\env\wechat-miniapp.local`
2. 检查本地管理员账号
3. 启动 API：`http://127.0.0.1:3000`
4. 启动后台：`http://127.0.0.1:3001/login`

它不会：

1. 修改支付逻辑
2. 修改顾客端购物车、checkout、订单支付流程
3. 实现优惠券、邀请、返利或会员价
4. 删除数据库数据

## 端口问题

如果端口被占用：

1. 先双击停止后台。
2. 再双击打开后台。
3. 如果仍然失败，请截图发给开发同事。

不要随便关闭不认识的程序。

## 正式上线提醒

正式商家版未来应该通过 HTTPS 后台网址登录，不需要商家运行这些本地脚本。
