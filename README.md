# A.L.I.C.E
一個當初為了[台姬殿](https://discord.gg/tvpc)設計的機器人

基於node.js跟discord.js所編寫

## 主要功能
1. 關鍵字回覆

![reply](https://i.imgur.com/CBpNraV.gif)

```/reply add {input} {output}```
```/reply delete {input}```
```/reply search {input/output}```

2. 身分組人數統計

![guild](https://i.imgur.com/gW28cFV.gif)

```/guild```
```/guild-role add {@&role}``` ```/guild-role delete {@&role}``` (設定要統計人數的身分組)

3. 大規模訊息刪除

![clear](https://i.imgur.com/Ojmm4oB.gif)

```/clear {year} {month} {day} {hour} {minute}``` (刪除該時間之後的訊息，最多 12 小時內)

4. 給特定身分組的人 另一個身分組

![role](https://i.imgur.com/2TZrWWV.gif)

```/give-role-with-role {member-role} {give-role}```
```/give-role {@member} {@&role}```

只能給予比自己最高身分組還低的身分組

5. 使用CSV做訊息量排序

![rank](https://i.imgur.com/fSDm2MU.gif)

```* rank``` (upload with CSV)

## 次要功能
1. 私下關心
2. 備份刪除訊息

```/backup add {#Channel}``` ```/backup delete```

3. 以Bot身分說話

```/broadcast {#Channel} {Output}```

## 部署

需求：Docker（或 Node.js 18+）、MySQL

1. 建立資料表：`mysql -u <user> -p <database> < schema.sql`
2. 複製 `server/config-sample.js` 為 `server/config.js`，填入 bot token、client ID 與資料庫連線資訊
3. 啟動：
   ```bash
   docker compose up -d --build        # 或不用 Docker：npm ci && npm start
   ```
4. 新增或修改斜線指令後，註冊到 Discord：
   ```bash
   docker compose run --rm alice npm run deploy-commands   # 或：npm run deploy-commands
   ```

`docker-compose.yml` 使用 host 網路，讓容器能連到同一台主機 `127.0.0.1` 上的 MySQL（僅適用 Linux 主機）。

## 可以優化的事項
- [x] 將不同伺服器的指令分開
- [x] 用資料庫儲存UUID相關資料

## Q&A
### 為什麼要叫A.L.I.C.E ?
單純我很廚刀劍神域然後覺得這個梗拿來用會很好玩
~~而且事實證明大家也很愛ALICE~~
