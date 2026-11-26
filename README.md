# 电文室 · HOI4 事件编辑器

为《钢铁雄心 IV》模组撰写国家事件与新闻事件，在报纸预览中检查排版，再直接下载事件脚本和简体中文本地化文件。[打开在线编辑器](https://lesmiserablesmod.github.io/hoi4-event-editor/)

## 编写事件

- 在左侧新建事件，每个事件有独立的 ID、标题、正文与选项。可以在多个标签之间切换。
- 点击彩色文字、图标或变量，在原位修改标记，点击别处后恢复渲染。选区复制保留原始游戏代码。
- 每个选项都可以填写触发条件、AI 权重与效果。切换接收国查看不同回应。依赖存档的条件会在画布下方提示。

## 下载游戏文件

点击文件行的下载图标可获取一组文件。打开该行的「…」可以单独下载脚本或本地化。在「批量下载」中勾选任意事件，可以合并所选事件，也可以为每个事件分别生成文件。下载清单里的文件名也可以单独点击。

| 文件 | 放入模组目录 | 内容 |
| --- | --- | --- |
| `.txt` | `events/` | 命名空间、事件定义和全部选项脚本 |
| `_l_simp_chinese.yml` | `localisation/simp_chinese/` | UTF-8 BOM 编码的简体中文文本，保留色码、变量和本地化键 |

工作区保存在当前浏览器。同一个项目换站点或设备时，在旧站「工作区备份」导出 JSON，再到新站恢复。

## 本地运行

在仓库根目录运行以下命令，然后打开 `http://localhost:8000/`。

```sh
python -m http.server 8000 --directory docs
```

使用 Node.js 22 或更高版本运行回归测试。

```sh
node --test
```

GitHub Pages 从 `main` 分支的 `/docs` 目录发布。前端使用原生 HTML、CSS 和 JavaScript，资源随仓库提供。

## 参考资料与素材

本地化与选项依据 [HOI4 Wiki · Localisation](https://hoi4.paradoxwikis.com/Localisation) 和 [HOI4 Wiki · Event modding](https://hoi4.paradoxwikis.com/Event_modding)。条件与效果名称参考 [Wiki 文档镜像](https://github.com/thelight0211/hoi4-wiki)。

内置默认国旗与部分文本图标来自《钢铁雄心 IV》游戏资源，游戏美术归原权利方所有。莱茵河畔的报纸配图为示例插画。报头字体的许可随文件提供。[游戏资源出处](https://github.com/Killeritch/Hearts-of-Iron-IV) · [字体许可](docs/assets/font-license.txt)
