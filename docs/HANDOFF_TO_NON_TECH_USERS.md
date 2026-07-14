# 绿膳荟后台交付给非技术同事使用说明

## 这是什么

这是绿膳荟商家后台的本地演示版启动包。

它适合内部同事在本机试用后台，不是正式线上后台。

## Mac 用户

打开：

```text
项目文件夹/mac
```

优先双击：

```text
start-admin-mac.command
```

如果中文文件名显示正常，也可以双击：

```text
打开绿膳荟后台.command
```

## Windows 用户

打开：

```text
项目文件夹/windows
```

优先双击：

```text
start-admin-windows.bat
```

如果中文文件名显示正常，也可以双击：

```text
打开绿膳荟后台.bat
```

Windows 脚本已生成，但必须在 Windows 真机上完成最终双击验证后，才能作为 Windows 交付通过。

## 登录地址

```text
http://127.0.0.1:3001/login
```

## 本地演示账号

```text
账号：admin
密码：<legacy-local-password-removed>
```

这是本地演示账号，不是正式线上账号。

## 怎么停止

Mac 双击：

```text
stop-admin-mac.command
```

Windows 双击：

```text
stop-admin-windows.bat
```

## 页面打不开怎么办

1. 先双击停止后台。
2. 再双击打开后台。
3. 等窗口提示后台已启动后再打开页面。
4. 如果仍打不开，请截图发给开发同事。

## 页面变成纯文字怎么办

Mac 双击：

```text
repair-admin-mac.command
```

Windows 双击：

```text
repair-admin-windows.bat
```

然后重新双击打开后台。

## 端口占用怎么办

1. 先双击停止后台。
2. 再双击打开后台。
3. 如果仍提示端口占用，请截图发给开发同事。

不要随便关闭不认识的程序。

## 什么情况要联系开发同事

1. 提示缺少运行环境。
2. 提示缺少本地环境配置文件。
3. 登录失败。
4. 页面一直打不开。
5. 页面一直没有样式。
6. 端口占用无法解决。

## 本地演示版和正式上线版的区别

本地演示版需要项目源码、Node.js、npm、本地数据库和本地环境配置文件。

正式上线后，商家只需要打开 HTTPS 后台网址登录，不需要安装 Node.js、npm、数据库，也不需要运行这些脚本。
