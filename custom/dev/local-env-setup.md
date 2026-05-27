# æœ¬åœ°å¼€å‘ç¯å¢ƒä¸ E2E æµ‹è¯•å‡†å¤‡

## å½“å‰å‰æ

æœ¬ä»“åº“æœ¬åœ°å¼€å‘ç°åœ¨ä»¥ä¸¤çª—å£å·¥ä½œæµä¸ºå‡†ï¼š

1. çª—å£ä¸€è¿è¡Œ `scripts/start-local.ps1`ï¼Œå¹¶ä¿æŒæ‰“å¼€ã€‚
2. çª—å£äºŒè¿è¡Œ `scripts/check-local.ps1` æˆ– `scripts/test-smoke.ps1`ã€‚
3. ç»“æŸæ—¶è¿è¡Œ `scripts/stop-local.ps1`ã€‚

å½“å‰ `.env` çš„æ•°æ®åº“åœ°å€ä»ç„¶æŒ‡å‘æœ¬æœº 55432ï¼š

```text
DATABASE_URL="postgresql://postgres@127.0.0.1:55432/wecom_growth_hub_demo?schema=public"
```

å¦‚æœæœ¬æœº PostgreSQL æ²¡æœ‰å¯åŠ¨ï¼Œ`start-local.ps1` ä¼šè‡ªåŠ¨æ£€æŸ¥è¿™äº›æœ¬åœ°æ•°æ®ç›®å½•ï¼Œä¼˜å…ˆé¡ºåºä¸ºï¼š

1. `.local/postgres-data`
2. `tmp/postgres-data`
3. `custom/experiments/postgres-data`

å¦‚æœè¿™äº›ç›®å½•éƒ½è¿˜æ²¡æœ‰åˆå§‹åŒ–ï¼Œè„šæœ¬ä¼šè‡ªåŠ¨æ‰§è¡Œ `initdb` åˆ›å»ºé»˜è®¤çš„ `.local/postgres-data`ã€‚

## æ¨èå¯åŠ¨æ–¹å¼

### çª—å£ä¸€ï¼šå¯åŠ¨æœ¬åœ°å¼€å‘ç¯å¢ƒ

```powershell
Set-Location D:\ceshi\qiwei
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\start-local.ps1
```

`start-local.ps1` ä¼šåœ¨å½“å‰ PowerShell å‰å°å®Œæˆè¿™äº›äº‹æƒ…ï¼š

1. åœæ‰æ—§çš„ node / Next dev è¿›ç¨‹ã€‚
2. æ¸…ç† `.next`ã€‚
3. æ£€æŸ¥ `DATABASE_URL`ã€‚
4. å¯åŠ¨å¹¶éªŒè¯æœ¬åœ° PostgreSQL fallback çš„ `55432 LISTENING`ã€‚
5. æ‰§è¡Œ `db:generate`ã€`db:push`ã€`db:seed`ã€`typecheck`ã€`lint`ã€`build`ã€‚
6. å†æ¬¡æ¸…ç† build äº§ç‰©ï¼Œé¿å… Next dev ä¸ç”Ÿäº§æ„å»ºç¼“å­˜æ··ç”¨ã€‚
7. æœ€åç›´æ¥è¿è¡Œ `npm.cmd run dev`ã€‚

è¿™ä¸ªçª—å£å¿…é¡»ä¿æŒæ‰“å¼€ï¼Œä¸è¦å…³é—­ã€‚

### çª—å£äºŒï¼šæ£€æŸ¥æœ¬åœ°å¯æ‰“å¼€çŠ¶æ€

```powershell
Set-Location D:\ceshi\qiwei
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\check-local.ps1
```

`check-local.ps1` ä¼šæ£€æŸ¥ï¼š

1. `55432` æ˜¯å¦ `LISTENING`
2. `3000` æ˜¯å¦ `LISTENING`
3. `node` / `postgres` è¿›ç¨‹
4. `/login` é¡µé¢æ˜¯å¦å¯è®¿é—®

è„šæœ¬ä¼šè¾“å‡º `Result: OPENABLE` æˆ– `Result: NOT OPENABLE`ã€‚

### çª—å£äºŒï¼šæ‰§è¡Œ smoke æµ‹è¯•

```powershell
Set-Location D:\ceshi\qiwei
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\test-smoke.ps1
```

`test-smoke.ps1` åªè´Ÿè´£æµ‹è¯•ï¼Œä¸ä¼šå°è¯•è‡ªåŠ¨æ‹‰èµ· dev serverã€‚  
å¦‚æœ 3000 ä¸å¯ç”¨ï¼Œå…ˆå›åˆ°çª—å£ä¸€é‡æ–°è¿è¡Œ `start-local.ps1`ã€‚

### ç»“æŸä¸æ¸…ç†

```powershell
Set-Location D:\ceshi\qiwei
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\stop-local.ps1
```

`stop-local.ps1` ä¼šï¼š

1. åœæ­¢ node / Next dev è¿›ç¨‹ã€‚
2. åœæ­¢èƒ½è¯†åˆ«åˆ°çš„æœ¬åœ° PostgreSQL fallbackã€‚
3. æ¸…ç† `.next` å’Œ `test-results`ã€‚
4. è¾“å‡º `3000` å’Œ `55432` çš„ç«¯å£çŠ¶æ€ã€‚

## æ‰‹åŠ¨ PostgreSQL fallback

å¦‚æœéœ€è¦å•ç‹¬æ’æŸ¥æœ¬æœº PostgreSQLï¼Œä¹Ÿå¯ä»¥æ‰‹åŠ¨æ‰§è¡Œï¼š

```powershell
Set-Location D:\ceshi\qiwei
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\run-postgres-fallback.ps1
```

è¿™åªæ˜¯æ‰‹åŠ¨æ’éšœå…¥å£ï¼Œæ­£å¸¸æ—¥å¸¸æµç¨‹ä»ä»¥ `start-local.ps1` + `check-local.ps1` / `test-smoke.ps1` ä¸ºå‡†ã€‚

## åˆ¤æ–­æ ‡å‡†

å½“ä»¥ä¸‹æ¡ä»¶åŒæ—¶æ»¡è¶³æ—¶ï¼Œæœ¬åœ°ç¯å¢ƒæ‰ç®—å¯æ‰“å¼€ï¼š

1. `55432 LISTENING`
2. `3000 LISTENING`
3. `/login` å¯è®¿é—®
4. `check-local.ps1` è¾“å‡º `Result: OPENABLE`

å¦‚æœä»»ä¸€æ¡ä»¶ä¸æ»¡è¶³ï¼Œä¸è¦ç›´æ¥ç»§ç»­ smoke æµ‹è¯•ï¼Œå…ˆå›åˆ°çª—å£ä¸€é‡æ–°å¯åŠ¨ã€‚

## V2.3.6£ºPostgreSQL fallback Æô¶¯ÅÅÕÏ

±¾µØÆô¶¯Ê§°ÜÊ±£¬ÏÈÇø·ÖÈıÀà×´Ì¬£º

1. `postgres.exe` ½ø³Ì´æÔÚ£¬µ« `55432` ÉĞÎ´ `LISTENING`£ºÍ¨³£ÊÇ±¾µØ PGDATA ÕıÔÚ»Ö¸´¡¢Í¬²½½ÏÂı£¬¾É½Å±¾ 30 ÃëµÈ´ı¿ÉÄÜ¹ı¶Ì¡£
2. `55432 LISTENING`£¬µ« `pg_isready` Î´½ÓÊÜÁ¬½Ó£ºËµÃ÷¶Ë¿ÚÒÑ´ò¿ª£¬µ«Êı¾İ¿âÈÔÎ´Íê³É»Ö¸´£¬²»Ó¦¼ÌĞøÆô¶¯µÇÂ¼Ò³ÑéÖ¤¡£
3. `postmaster.pid` ´æÔÚ£¬µ«¶Ë¿ÚÎ´¼àÌı£ºÕâÊÇ stale pid£¬`start-local.ps1` ºÍ `stop-local.ps1` »áÔÚÈ·ÈÏ 55432 Î´¼àÌıºóÇåÀí¡£

µ±Ç°ÍÆ¼öÁ÷³Ì£º

```powershell
Set-Location D:\ceshi\qiwei
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\stop-local.ps1
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\start-local.ps1
```

`start-local.ps1` ÒÑÏÔÊ½Ê¹ÓÃ `listen_addresses=127.0.0.1`£¬²¢µÈ´ı PostgreSQL ×î¶à 180 Ãë¡£Ê§°ÜÊ±»áÊä³ö£º

- PGDATA Â·¾¶
- `postmaster.pid`
- `postmaster.opts`
- `netstat` ¶Ë¿Ú×´Ì¬
- `.local\logs\postgres-start-local.stderr.log`
- `.local\logs\postgres-start-local.stdout.log`
- `.local\postgres-data\postgres-start-local.log`

Èç¹ûÈ·ÈÏ `.local\postgres-data` ÊÇ±¾µØ¿ª·¢¿âÇÒÒÑ¾­Ëğ»µ£¬¿ÉÖ´ĞĞ£º

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\repair-local-postgres.ps1 -Force
```

¸Ã½Å±¾»áÏÈµ÷ÓÃ `stop-local.ps1`£¬ÔÙ°Ñ¾É PGDATA ÒÆ¶¯µ½ `.local\postgres-data.backup-Ê±¼ä´Á`£¬×îºóÖØĞÂ `initdb`¡£ËüÖ»ÓÃÓÚ±¾µØ¿ª·¢»·¾³£¬²»ÓÃÓÚÉú²ú¡£
