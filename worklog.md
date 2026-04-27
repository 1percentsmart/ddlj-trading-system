---
Task ID: 1
Agent: Main Agent
Task: DDLJ v8.4 Strategy - API Connection & Deep Analysis with 7 Fixes

Work Log:
- Examined all 14 Python source files in the DDLJ v8.4 strategy package
- Updated config.py with API secret (tkg39m07fqan0h1yzirpyilmvovf9gr8)
- Exchanged request_token (EeU4JBYusoahaHM9Wts1JRUAjbFIbKCf) for access token
- Verified API connection: logged in as Sameer Gani Shaikh (IV2860)
- Tested all API endpoints: historical data, instruments, VIX, margins
- Identified 7 actionable bugs/fixes through deep code analysis
- Implemented all 7 fixes and verified each one

Stage Summary:
- API connection fully operational with valid access token saved
- 7 fixes implemented and verified:
  1. VIX Data Path: Auto-detect VIX file instead of hardcoded path (117 days loaded)
  2. Data Fetcher Integration: run_backtest.py now auto-fetches from API if cache empty
  3. Cache Directory: Unified both modules to use /home/z/my-project/kite_cache_v10
  4. DTE Weekly Expiry: Changed from monthly to weekly (Thursday) expiry calculation
  5. Signal Pattern 2: Added pullback-to-EMA check for continuation signals
  6. Token File Path: Changed from relative to absolute path
  7. Dynamic Futures Tokens: Resolved current month's futures tokens via API
