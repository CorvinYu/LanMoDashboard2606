# Open Source References

这个文档记录本项目参考、接入或复制过的开源项目。

原则：

- 参考项目统一 clone 到 `references/opensource/` 下。
- `references/opensource/` 中的第三方源码默认不提交到本项目仓库。
- 如果只是阅读和借鉴设计，记录为 `Code copied: No`。
- 如果复制了代码，必须记录复制来源、目标位置、修改内容和许可证义务。
- 不同许可证的项目可以同时参考，但实现时必须保留清晰边界。

## Reference Log

### Donetick

- URL: https://github.com/donetick/donetick
- Local path: `references/opensource/donetick`
- License: AGPL-3.0
- Status: cloned reference
- Used for:
  - 参考规律事项、家务、周期打卡类功能的产品设计。
  - 参考完成记录、下次到期、逾期提醒和历史统计的实现思路。
- Code copied: No
- Integration style:
  - 优先研究设计后在本项目中重新实现。
  - 不直接混入本项目的 `Task` 模型。
- Analysis:
  - See `DONETICK_REFERENCE_ANALYSIS.md`.
- Notes:
  - 如果后续复制代码或作为服务接入，需要补充具体文件、修改内容和 AGPL-3.0 义务。

### DickHelper

- URL: https://github.com/zzzdajb/DickHelper
- Local path: `/tmp/DickHelper`
- License: GPL-3.0
- Status: cloned reference for evaluation
- Used for:
  - 评估是否可作为“兴趣记录 / 频率可视化 / 打卡统计”能力的参考。
  - 参考记录模型、导入导出、趋势统计、热力图、按小时/星期/月分布等产品设计。
- Code copied: No
- Integration style:
  - 不建议直接复制或合并源码。
  - 可借鉴设计后，在本项目的 NestJS + Prisma + React 结构中重新实现。
- Notes:
  - 该项目是 Electron + React 19 + Mantine + sql.js/SQLite 的桌面优先应用，另有 Cloudflare Worker 排行榜服务，和本项目 React 18 + NestJS + Prisma + PostgreSQL 架构差异较大。
  - GPL-3.0 对直接复制代码进入本项目有强传染性要求；当前只作为设计参考，不复制代码。
  - 可借鉴点包括 `packages/core/src/recordImportExport.ts` 的导入导出思路、`packages/core/src/prediction/analyzePrediction.ts` 的间隔分析思路、`src/renderer/views/StatsChart.tsx` 的统计看板和热力图组织方式。

## Entry Template

### Project Name

- URL:
- Local path:
- License:
- Status: reference / dependency / service / code-copied / removed
- Used for:
  - 
- Code copied: No / Yes
- If copied:
  - Source files:
  - Destination files:
  - Changes made:
  - License obligations:
- Integration style:
  - 
- Notes:
  - 
