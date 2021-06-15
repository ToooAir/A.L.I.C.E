# A.L.I.C.E
一個當初為了[台姬殿](https://discord.gg/tvpc)設計的機器人

基於node.js跟discord.js所編寫

充滿大量寫死的UUID 不方便別人更改

## 主要功能
1. 關鍵字回覆

![reply](https://i.imgur.com/CBpNraV.gif)
```* reply add {input} {output}```
```* reply delete {input}```
```* reply search {input/output}```

2. 身分組人數統計

![guild](https://i.imgur.com/gW28cFV.gif)
```* guild```

3. 大規模訊息刪除

![clear](https://i.imgur.com/Ojmm4oB.gif)
```* clear {yyyy MM dd HH mm}```

4. 給特定身分組的人 另一個身分組

![role](https://i.imgur.com/2TZrWWV.gif)
```* role {@&role_1} {@&role_2}```

5. 使用CSV做訊息量排序

![rank](https://i.imgur.com/fSDm2MU.gif)
```* rank``` (upload with CSV)

## 次要功能
1. 私下關心
2. 備份刪除訊息
3. 以Bot身分說話
```* broadcast {#Channel} {Output}```

## 可以優化的事項
- [ ] 將不同伺服器的指令分開
- [ ] 用資料庫儲存UUID相關資料

## Q&A
### 為什麼要叫A.L.I.C.E ?
單純我很廚刀劍神域然後覺得這個梗拿來用會很好玩
~~而且事實證明大家也很愛ALICE~~
