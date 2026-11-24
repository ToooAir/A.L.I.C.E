# A.L.I.C.E

一個當初為了[台姬殿](https://discord.gg/tvpc)設計的 Discord 機器人，基於 Node.js 與 discord.js v14 編寫，資料存放在 MySQL。

- [功能](#功能)
- [指令一覽](#指令一覽)
- [部署](#部署)
- [專案結構](#專案結構)
- [測試](#測試)
- [Q&A](#qa)

## 功能

### 1. 關鍵字回覆

![reply](https://i.imgur.com/CBpNraV.gif)

```
/reply add {觸發關鍵字} {回覆內容}
/reply delete {觸發關鍵字}
/reply search {關鍵字}
/reply help
```

- 訊息內容**完全等於**關鍵字時觸發，不分大小寫
- 回覆內容用 `^` 分隔多個回覆，會隨機挑一個：`早安^午安^晚安`
- 回覆內容中的 `{m}` 會換成觸發者的 tag
- 每個伺服器的關鍵字各自獨立；私訊愛麗絲時則可觸發任何伺服器的關鍵字
- 長度限制：關鍵字 256 字、回覆內容 1024 字

### 2. 伺服器與身分組人數統計

![guild](https://i.imgur.com/gW28cFV.gif)

```
/guild
/guild-role add {@身分組}
/guild-role delete {@身分組}
```

`/guild` 顯示總人數、線上／閒置／請勿打擾人數，以及用 `/guild-role` 設定的身分組人數。

### 3. 大規模訊息刪除

![clear](https://i.imgur.com/Ojmm4oB.gif)

```
/clear {年} {月} {日} {時} {分}
```

刪除目前頻道中「指定時間之後」到現在的所有訊息，最多只能往回 12 小時。時間以主機時區計算（Docker 部署時固定為台灣時間 Asia/Taipei）。

### 4. 批次給予身分組

![role](https://i.imgur.com/2TZrWWV.gif)

```
/give-role-with-role {擁有此身分組的人} {要給予的身分組}
/give-role {@成員} {@身分組}
```

為了避免權限濫用，只能給予**比自己最高身分組還低**的身分組（伺服器擁有者除外），且不能給予管理員或由整合服務管理的身分組。

### 5. 討論區訊息量排序

```
/rank {天數} {分類}
```

依最近幾天的訊息數排序分類底下的頻道，用來找出熱門或冷門的討論區。

- 愛麗絲會自己累積每個頻道每天的訊息數（只存數字，不存訊息內容），不需要再上傳 CSV
- 天數 1–90，預設 7 天（含今天）；沒選分類時使用 `config.js` 的 `rankCategoryIds`
- 討論串與論壇貼文的訊息算在上層頻道；bot 的訊息不計算
- 沒有訊息的頻道也會列出（0 則），排在最後
- 資料從功能上線那天開始累積，查詢範圍更早時會標註資料起始日

### 其他

- **刪除訊息備份**：`/backup add {#頻道}` 設定後，被刪除的訊息會備份到該頻道；`/backup delete` 關閉
- **以愛麗絲的身分說話**：`/broadcast {#頻道} {訊息}`
- **@everyone 防護**：沒有「提及 @everyone」權限的人發出含 `@everyone` 的訊息會被自動刪除
- **私下關心**：試著對愛麗絲說「我討厭你」🥺
- **打招呼**：訊息裡有「嗨愛麗絲」就會回應
- `/about` 顯示自我介紹與延遲

## 指令一覽

「預設權限」是 Discord 上能看到並使用該指令的權限，伺服器管理員可以在「伺服器設定 → 整合 → A.L.I.C.E」另外調整。

| 指令 | 說明 | 預設權限 |
|---|---|---|
| `/reply add·delete·search·help` | 關鍵字回覆 | 所有人 |
| `/guild` | 伺服器統計 | 所有人 |
| `/about` | 自我介紹 | 所有人 |
| `/guild-role add·delete` | 設定統計的身分組 | 管理伺服器 |
| `/backup add·delete` | 刪除訊息備份 | 管理伺服器 |
| `/broadcast` | 以 bot 身分發言 | 管理伺服器 |
| `/clear` | 批次刪除訊息 | 管理訊息 |
| `/give-role` | 給予成員身分組 | 管理身分組 |
| `/give-role-with-role` | 批次給予身分組 | 管理身分組 |
| `/rank` | 討論區訊息量排序 | 管理頻道 |

## 部署

### 需求

- Docker（或 Node.js 18 以上）
- MySQL（支援 MySQL 8）

### 1. 建立 Discord Bot

1. 在 [Discord Developer Portal](https://discord.com/developers/applications) 建立應用程式與 Bot
2. 在 **Bot → Privileged Gateway Intents** 開啟這三個 intent，否則 bot 會無法登入：
   - Server Members Intent（成員統計、身分組）
   - Presence Intent（線上人數）
   - Message Content Intent（關鍵字回覆）
3. 邀請 bot 進伺服器時給予以下權限：檢視頻道、傳送訊息、嵌入連結、新增反應、讀取訊息歷史、**管理訊息**、**管理身分組**
4. 若要使用 `give-role` 系列指令，愛麗絲的身分組必須排在要給予的身分組**之上**

### 2. 設定

```bash
mysql -u <user> -p <database> < schema.sql      # 建立資料表
cp server/config-sample.js server/config.js     # 再填入下列設定
```

| 設定 | 說明 |
|---|---|
| `clientId` | 應用程式 ID |
| `token` | Bot token（**不要 commit**，已列在 `.gitignore`） |
| `mysqlConnect` | MySQL 連線資訊 |
| `rankCategoryIds` | （選填）`/rank` 預設排序的分類 ID |

### 3. 啟動

```bash
docker compose up -d --build
docker compose run --rm alice npm run deploy-commands   # 註冊斜線指令
docker compose logs -f                                  # 看到 [Ready] Logged in as ... 即成功
```

不使用 Docker：

```bash
npm ci
npm run deploy-commands
npm start
```

### 注意事項

- **從舊版升級時**重新執行一次 `schema.sql`：只會建立缺少的資料表，既有資料不受影響
- `config.js` 裡舊的 `prefix` 設定已不再使用，留著也沒關係
- **新增或修改斜線指令後**要重新執行 `deploy-commands`，bot 啟動時不會自動註冊
- `docker-compose.yml` 使用 host 網路，讓容器能連到同一台主機上 `127.0.0.1` 的 MySQL（僅適用 Linux 主機）
- `config.js` 以唯讀方式掛載進容器，不會被打包進 image
- 同一個 token 只能跑一個實例：從 pm2 換到 Docker 時，請先 `pm2 stop` / `pm2 delete` 再啟動容器，否則每則訊息都會被回覆兩次

## 專案結構

```
alice.js                    進入點
test/                       單元測試（unit/）與資料庫整合測試（db/）
schema.sql                  資料表結構
server/
├── bot.js                  Discord client 與事件處理
├── regCommand.js           註冊斜線指令（npm run deploy-commands）
├── config-sample.js        設定範本
├── command/                斜線指令，一個檔案一個指令
└── plugin/
    ├── mysql.js            資料庫存取
    ├── talk.js             關鍵字回覆與聊天反應
    ├── activity.js         各頻道每日訊息數統計（/rank）
    ├── permission.js       身分組位階與 @everyone 權限檢查
    └── embed/              Embed 訊息樣式
```

新增斜線指令：在 `server/command/` 新增檔案並匯出 `data`（`SlashCommandBuilder`）與 `execute(interaction)`，再執行 `npm run deploy-commands`。

## 測試

使用 Node 內建的 `node:test`，不需要額外安裝套件。

```bash
npm test          # 單元測試：不需要資料庫，也不會連到 Discord
npm run test:db   # 資料庫整合測試：需要一個 MySQL
```

`test:db` 預設連到 `127.0.0.1:33306` 的 `alice_test` 資料庫（帳號 `root` / `testpw`），可以用一個暫時的容器：

```bash
docker run -d --rm --name alice-test-db -e MYSQL_ROOT_PASSWORD=testpw -p 33306:3306 mysql:8.4
npm run test:db
docker stop alice-test-db
```

連線資訊可以用 `TEST_MYSQL_HOST`、`TEST_MYSQL_PORT`、`TEST_MYSQL_USER`、`TEST_MYSQL_PASSWORD`、`TEST_MYSQL_DATABASE` 覆寫。整合測試會清空資料表，所以資料庫名稱必須以 `_test` 結尾，否則會拒絕執行。

測試一律使用 `test/helpers/config.js`，不會讀取 `server/config.js`，也就不會碰到正式的 token 或資料庫。

## Q&A

### 為什麼要叫 A.L.I.C.E？

單純我很廚刀劍神域，然後覺得這個梗拿來用會很好玩
~~而且事實證明大家也很愛 ALICE~~
