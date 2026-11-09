## 词库来源与授权

本仓库作为组合发布物按 **GPL-3.0-only** 分发；仓库根目录 [`LICENSE`](LICENSE) 为雾凇拼音上游的 GNU GPL v3 完整原文。**本版本已修改上游词库**：仅选择并转换部分有明确拼音与数值权重的词条，重新去重、截取、排序并打包为浏览器模块；不代表上游原词库或上游完整输入法。`src/lexicon.js` 是雾凇拼音词库的筛选、去重及重排派生数据，**不是 MIT 许可**。未另行引入其他语料。最初游戏代码由 sqchenxiyuan 按 MIT 许可发布；其原始 MIT 授权和版权声明保留于下方，MIT 许可与本组合发布物的 GPL 授权不同。

- 来源：[iDvel/rime-ice（雾凇拼音）](https://github.com/iDvel/rime-ice)，固定 commit [`99662ba01e3affa6a0f009174ca530b887bac3b6`](https://github.com/iDvel/rime-ice/tree/99662ba01e3affa6a0f009174ca530b887bac3b6/cn_dicts)，上游授权 GPL-3.0；上游版权和词库子来源说明请参阅上游各 `.dict.yaml` 头部、仓库 README 和 LICENSE。下载该提交的 `cn_dicts` 中三个明确注音文件：
  - `8105.dict.yaml` SHA-256 `1f9a42b91dea6982baee2551981780271aeffd78876662b9c9f324e56b37b120`
  - `base.dict.yaml` SHA-256 `551cad93c2e74c7325599e0d23afbf71c2d2e57df9af3f8f6fa16d87e60290a3`
  - `ext.dict.yaml` SHA-256 `d2d52bf75f7bcdd8a4afb036ab879415a7e620e529a4ecebc71780fe7ccdf648`
- 上游 `8105` 头部注明参考《通用规范汉字表》的维基词典拼音索引及北京语言大学 25 亿字汉字字频表；`base` 头部注明汇集华宇野风系统词库、清华 THUOCL、现代汉语常用词表、腾讯词向量及多部词典参考，并由雾凇拼音维护者修正。`ext` 是上游扩展词库。因此**没有单独引入无注音的 `tencent.dict.yaml`，但 `base` 的上游来源包含腾讯词向量补充词语**。详细各来源链接及权利声明以固定版本的上游字典头部、README 和 LICENSE 为准。
- 转换：[`scripts/generate-rime-ice.py`](scripts/generate-rime-ice.py) 在本地读取上述文件并**逐文件校验 SHA-256**（仅测试用 `--fixture` 可跳过），用 Python 标准库解析 Rime 字典头后的制表符分隔三列 `词条 / 空格分隔的拼音 / 十进制权重`；剔除非汉字、拼音/字符数不等及非小写拉丁拼音词条。`8105` 的合格明确注音单字全保留；`base` 仅保留不超过六字且权重 ≥1000 的词条，每个无空格拼写最多按数值权重保留 24 个；`ext` 仅保留不超过四字、与已收录拼写相同的词条，每拼写最多 6 个。跨源按相同拼写和词条去重，取最大权重。未注音词条（例如单独的 `tencent.dict.yaml`）**没有推测读音，也没有直接收录**；本项目不宣称覆盖雾凇拼音全部词汇。
- 本次输出 `src/lexicon.js` SHA-256 `4db9dbb8e5bebb81761fe5d6eb18d42987ea803b421403e045904491c859d616`，6,594,229 字节（gzip 约 2.59 MB），192,418 个连续拼音键、249,360 条字词/读音记录。源文件不进入浏览器构建；浏览器只下载本地静态模块，没有服务端、在线词典或联网生成步骤。发布时请连同本文件、完整 LICENSE、生成脚本与对应源代码一起提供。
- 游戏的排序不是 Rime 引擎的整套分词/联想算法：完整拼写候选优先，随后按原数字权重选前缀候选，同权按 Unicode 码位；去重并每次最多显示 250 项，每页五项。无动态词频、自动注音、用户词典、音节切分、整句预测或学习。

## 原游戏代码 MIT 声明（保留其历史版权）

MIT License

Copyright (c) 2026 sqchenxiyuan

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
