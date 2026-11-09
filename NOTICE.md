# 第三方词库来源及许可证

`src/lexicon.js` 是固定版本的派生词库，非专有输入法数据。构建源为 [pinyin-to-chinese](https://github.com/uranbekanarbaev/pinyin-to-chinese) 的 `scripts/build-ime.js`（commit `7cc444c9cf412a674eabe5bbbf1e33061002efb6`，Copyright © 2026 Uranbek Anarbaev，MIT）。使用相同打包算法，由以下输入重新生成；**未**使用上游随附的带 HSK 排序的 `data/ime-data.js`，也**未**提供 HSK 文件（其词表来源许可未明确）。仅保留打包结果中的 `k` 候选键及对应频率等级，忽略声调与语料总量。源脚本另有少量 `EXTRA_WORDS` 手工增补；它们也在本结果内。

- [jieba](https://github.com/fxsjy/jieba) 0.42.1 `dict.txt`：词频，Copyright (c) 2013 Sun Junyi，MIT；输入 SHA-256 `7197c3211ddd98962b036cdf40324d1ea2bfaa12bd028e68faa70111a88e12a8`。
- [pinyin-pro](https://github.com/zh-lx/pinyin-pro) 3.27.0：字词读音，Copyright (c) 2022-present zh-lx，MIT。

生成方式：用 pinyin-pro 3.27.0 运行上述上游脚本，传入 jieba 0.42.1 的 `dict.txt` 及不存在的 HSK 路径；输出 `ime-data.js` 的 SHA-256 为 `59890e2a615c039393b9c822e6441607996c25e81ae6e753f86605291ad43e98`（70,695 条记录：24,672 条单字读音记录，对应 20,856 个不同汉字；46,023 个多字词；37,220 个拼音键）。将 `k` 作为 `PACKED_LEXICON` 导出生成 `src/lexicon.js`。运行时无下载或在线接口。所用文件按 MIT 授权，许可证全文如下；原项目的许可证见仓库根目录 `LICENSE`。

## pinyin-to-chinese / jieba / pinyin-pro MIT License

MIT License

Copyright (c) 2026 Uranbek Anarbaev
Copyright (c) 2013 Sun Junyi
Copyright (c) 2022-present zh-lx

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
