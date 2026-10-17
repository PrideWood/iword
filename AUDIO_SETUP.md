# iWord 发音资源准备说明

## 已选方案

当前播放使用登录后的服务端 `/api/pronunciation`：复用私有 COS 中已有 MP3，缺失时由 YunMia 自动生成、上传并写入数据库索引，返回短期签名地址。生成失败会显示重试提示，不再自动切换浏览器语音。

结合现有云资源，首选链路调整为“离线批量生成音频 + 独立腾讯云 COS 音频存储桶”。腾讯云语音合成可作为首选试听候选；只有在实际确认所选音色分别满足美音、英音要求后再批量生成。未来替换成其他具有明确商用授权的 TTS 服务或真人录音时，前端代码无需更改。

当前体验版本已选定腾讯云超自然大模型音色 `YunMia` 作为 `en-US v1` 发音人。官方音色 ID 为 `403006`，接口参数使用英文主语言、MP3、24 kHz、标准语速。当前不准备 `en-GB`，前端也不显示口音选择器。

## 自动同步

`npm run audio:sync` 已把以下步骤串成一次任务：

1. 从演示词表或 PostgreSQL/Neon 读取单词。
2. 对已有清单和 COS 对象去重，默认不重复消耗 TTS 额度。
3. 只为缺失单词调用 YunMia，直接获得 MP3。
4. 上传音频到 `pronunciations/v1/en-US/`。
5. 所有音频完成后，最后更新 COS 与本地的 `manifest.json`。

因此不需要逐个下载、改清单、再手工上传。任务中途失败时不会提前发布新清单，再次运行即可继续。第一次建议先预览并只生成 3 个词：

```sh
npm run audio:plan
npm run audio:sync -- --limit=3
```

当前未接数据库时默认使用内置演示词表。接入 Neon 后，把 `.env.local` 中的 `PRONUNCIATION_WORD_SOURCE` 改为 `database`，同一个命令就会读取数据库词表。

### 服务端凭据

不要使用主账号密钥，也不要把密钥发送到聊天、写入前端代码或提交到 Git。推荐在腾讯云访问管理（CAM）创建一个仅用于本任务的“编程访问”子用户，为它建立自定义策略。下面的资源值已经按当前重庆桶填写；如果以后换桶，再同步修改：

```json
{
  "version": "2.0",
  "statement": [
    {
      "effect": "allow",
      "action": ["tts:TextToVoice"],
      "resource": ["*"]
    },
    {
      "effect": "allow",
      "action": [
        "name/cos:GetObject",
        "name/cos:HeadObject",
        "name/cos:PutObject"
      ],
      "resource": [
        "qcs::cos:ap-chongqing:uid/1323793543:iword-pronunciation-1323793543/pronunciations/v1/*"
      ]
    }
  ]
}
```

子用户创建 SecretId/SecretKey 后，只在本机 `.env.local` 中填写：

```text
TENCENTCLOUD_SECRET_ID=创建时显示的 SecretId
TENCENTCLOUD_SECRET_KEY=创建时仅显示一次的 SecretKey
TENCENT_COS_BUCKET=iword-pronunciation-1323793543
TENCENT_COS_REGION=ap-chongqing
TENCENT_COS_PREFIX=pronunciations/v1
TENCENT_TTS_VOICE_TYPE=403006
TENCENT_TTS_SAMPLE_RATE=24000
TENCENT_TTS_SPEED=0
PRONUNCIATION_WRITE_LOCAL=true
PRONUNCIATION_WORD_SOURCE=seed
```

## 需要准备的资源

### 1. 内容与授权

- 最终需要覆盖的英文词表，至少包含 `term`、词性和音标。
- 已确认的美式英语发音人 YunMia；若未来需要英音，再单独选择音色和建立新版本目录。
- TTS 服务允许保存、分发和用于当前教学产品的书面授权依据或服务条款快照。
- 如果购买真人词典录音，需要取得在网站/App 中播放、缓存和通过 CDN 分发的许可。
- 禁止直接抓取词典网站音频或解包词典笔资源。

### 2. 云服务

- 现有腾讯云账号，以及一个单独新建的 COS 音频存储桶。不要与笔记图片桶混用。
- 开通腾讯云语音合成服务并试听英文音色；若没有满意的英式音色，可只把 COS 作为存储层，改用其他已授权的生成来源。
- COS 存储桶区域优先选择主要用户所在地附近的中国内地区域；存储桶名称可使用 `iword-pronunciation-prod` 一类容易辨识的名称。
- 自定义域名和 HTTPS 证书；若使用中国内地 CDN/COS 域名，需要按云服务商要求完成备案。
- 正式域名的 DNS 管理权限。
- COS 跨域规则允许正式站点、Vercel Preview 域名和本地调试站点读取清单；允许方法配置 `GET`、`HEAD`，不要开放浏览器端写入权限。

推荐新建存储桶而不是复用笔记图片桶，原因是音频可以独立设置公开读取、跨域来源、CDN 缓存、生命周期和费用标签，不会扩大笔记图片的访问范围。建议配置如下：

- 存储桶用途：只放发音清单和音频，不存用户上传内容。
- 读取方式：优先使用私有 COS 回源到 CDN，由 CDN 域名公开读取；初期也可对这一个专用桶开放对象读取。
- 写入方式：只允许服务端生成脚本或 CI 使用最小权限凭据写入，浏览器不持有密钥。
- CORS 来源：`http://localhost:3000`、正式域名，以及确实需要的 Vercel Preview 域名。
- CORS 方法：`GET`、`HEAD`；Header 可先用 `*`，不开放 `PUT`、`POST`、`DELETE`。
- 音频缓存：`Cache-Control: public, max-age=31536000, immutable`，并使用 `v1`、`v2` 版本目录避免覆盖。
- 清单缓存：建议 5 分钟左右，或者每次发布新版本时更换清单 URL。
- Content-Type：清单为 `application/json`，MP3 为 `audio/mpeg`。

### 3. 音频标准

- 格式：优先 MP3，单声道，24 kHz 或服务支持的接近规格。
- 文件只保留单词发音，开头和结尾不要有明显长静音。
- 当前只使用 `en-US/`；未来增加其他口音时再使用独立目录。
- 对一词多音按词性或音标建立多个条目，并指定一个 `isDefault: true` 的默认读音。
- 批量生成后抽检音量、重音、截断、数字/缩写和专有名词。

### 4. 发音清单

离线批处理的本地清单位于 `public/audio/pronunciations/manifest.json`，音频路径相对于清单文件解析：

```json
{
  "schemaVersion": 1,
  "generatedAt": "2026-10-17T00:00:00.000Z",
  "entries": [
    {
      "term": "network",
      "accent": "en-US",
      "src": "en-US/network.mp3",
      "partOfSpeech": "n.",
      "phonetic": "/ˈnetwɜːrk/",
      "isDefault": true,
      "source": "tencent-cloud-tts",
      "license": "内部授权记录编号"
    }
  ]
}
```

远程部署时，将清单和音频保持相同的相对目录结构。清单可以放在 COS/CDN，例如：

```text
https://audio.example.cn/pronunciations/v1/manifest.json
https://audio.example.cn/pronunciations/v1/en-US/network.mp3
```

旧版 CDN 直连清单可保留作离线分发；当前网页无需配置下面的旧变量：

```text
NEXT_PUBLIC_PRONUNCIATION_MANIFEST_URL=https://audio.example.cn/pronunciations/v1/manifest.json
```

这是公开资源地址，不要在 `NEXT_PUBLIC_` 环境变量或清单里放 TTS、COS 密钥。

## 本地验收

1. 运行 `npm run audio:plan` 查看缺失单词。
2. 运行 `npm run audio:sync -- --limit=3` 生成小批量测试资源。
3. 运行 `npm run audio:validate`。
4. 启动 `npm run dev`，进入学生端预览并试听。
5. 在单词库添加一个新词并点击扬声器，验证首次自动生成后可重复播放。

## 上线前清单

- 音频资源版本化，不直接覆盖已经发布的目录；新版本使用 `v2` 等新路径。
- COS 只公开读音频和清单，不公开列目录、写入或删除权限。更严格的阶段可改为 CDN 鉴权，但需同步处理前端签名 URL。
- TTS 和 COS 的访问密钥只放在本地生成脚本/CI 的服务端密钥中，建议使用最小权限子账号或角色，不使用主账号永久密钥。
- CDN 为 MP3、JSON 配置正确的 Content-Type、缓存策略和 HTTPS。
- Vercel 的 Preview 与 Production 分别配置数据库与腾讯云服务端变量，详见 DEPLOYMENT.md。
- 记录每批音频的生成时间、发音人、来源、授权和词表版本。
