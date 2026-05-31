─(idevo㉿ll)-[~/Documents/projects/XyPriss]
└─$ bash bench/routing-bench/scripts/bench_all.sh

##############################################
#   XyPriss Routing API Benchmark Suite      #
##############################################

[1/3] Running Express baseline...
==========================================
 Baseline: Express
==========================================
[*] Starting Express server...
[*] Waiting for port 8091...
Express listening on port 8091
[*] Warmup...
Running 3s test @ http://127.0.0.1:8091/api/data
10 connections


┌─────────┬──────┬──────┬───────┬───────┬─────────┬────────┬───────┐
│ Stat    │ 2.5% │ 50%  │ 97.5% │ 99%   │ Avg     │ Stdev  │ Max   │
├─────────┼──────┼──────┼───────┼───────┼─────────┼────────┼───────┤
│ Latency │ 2 ms │ 4 ms │ 11 ms │ 14 ms │ 4.96 ms │ 2.9 ms │ 52 ms │
└─────────┴──────┴──────┴───────┴───────┴─────────┴────────┴───────┘
┌───────────┬────────┬────────┬────────┬────────┬────────┬────────┬────────┐
│ Stat      │ 1%     │ 2.5%   │ 50%    │ 97.5%  │ Avg    │ Stdev  │ Min    │
├───────────┼────────┼────────┼────────┼────────┼────────┼────────┼────────┤
│ Req/Sec   │ 1 327  │ 1 327  │ 1 707  │ 2 429  │ 1 821  │ 457,06 │ 1 327  │
├───────────┼────────┼────────┼────────┼────────┼────────┼────────┼────────┤
│ Bytes/Sec │ 408 kB │ 408 kB │ 524 kB │ 745 kB │ 559 kB │ 140 kB │ 407 kB │
└───────────┴────────┴────────┴────────┴────────┴────────┴────────┴────────┘

Req/Bytes counts sampled once per second.
# of samples: 3

5k requests in 3.03s, 1.68 MB read

--- 100 connections ---
Running 10s test @ http://127.0.0.1:8091/api/data
100 connections


┌─────────┬───────┬───────┬───────┬────────┬─────────┬──────────┬────────┐
│ Stat    │ 2.5%  │ 50%   │ 97.5% │ 99%    │ Avg     │ Stdev    │ Max    │
├─────────┼───────┼───────┼───────┼────────┼─────────┼──────────┼────────┤
│ Latency │ 22 ms │ 34 ms │ 95 ms │ 107 ms │ 42.5 ms │ 21.01 ms │ 166 ms │
└─────────┴───────┴───────┴───────┴────────┴─────────┴──────────┴────────┘
┌───────────┬────────┬────────┬────────┬───────┬─────────┬────────┬────────┐
│ Stat      │ 1%     │ 2.5%   │ 50%    │ 97.5% │ Avg     │ Stdev  │ Min    │
├───────────┼────────┼────────┼────────┼───────┼─────────┼────────┼────────┤
│ Req/Sec   │ 1 330  │ 1 330  │ 2 223  │ 3 267 │ 2 325,7 │ 600,17 │ 1 330  │
├───────────┼────────┼────────┼────────┼───────┼─────────┼────────┼────────┤
│ Bytes/Sec │ 408 kB │ 408 kB │ 682 kB │ 1 MB  │ 714 kB  │ 184 kB │ 408 kB │
└───────────┴────────┴────────┴────────┴───────┴─────────┴────────┴────────┘

Req/Bytes counts sampled once per second.
# of samples: 10

23k requests in 10.08s, 7.14 MB read

--- 1000 connections ---
Running 10s test @ http://127.0.0.1:8091/api/data
1000 connections


┌─────────┬────────┬────────┬────────┬────────┬───────────┬───────────┬────────┐
│ Stat    │ 2.5%   │ 50%    │ 97.5%  │ 99%    │ Avg       │ Stdev     │ Max    │
├─────────┼────────┼────────┼────────┼────────┼───────────┼───────────┼────────┤
│ Latency │ 258 ms │ 309 ms │ 778 ms │ 839 ms │ 353.23 ms │ 119.98 ms │ 882 ms │
└─────────┴────────┴────────┴────────┴────────┴───────────┴───────────┴────────┘
┌───────────┬────────┬────────┬────────┬─────────┬────────┬────────┬────────┐
│ Stat      │ 1%     │ 2.5%   │ 50%    │ 97.5%   │ Avg    │ Stdev  │ Min    │
├───────────┼────────┼────────┼────────┼─────────┼────────┼────────┼────────┤
│ Req/Sec   │ 1 841  │ 1 841  │ 2 477  │ 3 425   │ 2 762  │ 580,59 │ 1 841  │
├───────────┼────────┼────────┼────────┼─────────┼────────┼────────┼────────┤
│ Bytes/Sec │ 565 kB │ 565 kB │ 760 kB │ 1.05 MB │ 848 kB │ 178 kB │ 565 kB │
└───────────┴────────┴────────┴────────┴─────────┴────────┴────────┴────────┘

Req/Bytes counts sampled once per second.
# of samples: 10

29k requests in 10.41s, 8.48 MB read

--- 5000 connections ---
Running 10s test @ http://127.0.0.1:8091/api/data
5000 connections


┌─────────┬─────────┬─────────┬─────────┬─────────┬────────────┬───────────┬─────────┐
│ Stat    │ 2.5%    │ 50%     │ 97.5%   │ 99%     │ Avg        │ Stdev     │ Max     │
├─────────┼─────────┼─────────┼─────────┼─────────┼────────────┼───────────┼─────────┤
│ Latency │ 1234 ms │ 1735 ms │ 2152 ms │ 2167 ms │ 1749.16 ms │ 256.52 ms │ 2203 ms │
└─────────┴─────────┴─────────┴─────────┴─────────┴────────────┴───────────┴─────────┘
┌───────────┬────────┬────────┬────────┬─────────┬─────────┬────────┬────────┐
│ Stat      │ 1%     │ 2.5%   │ 50%    │ 97.5%   │ Avg     │ Stdev  │ Min    │
├───────────┼────────┼────────┼────────┼─────────┼─────────┼────────┼────────┤
│ Req/Sec   │ 835    │ 835    │ 2 437  │ 3 375   │ 2 494,4 │ 771,63 │ 835    │
├───────────┼────────┼────────┼────────┼─────────┼─────────┼────────┼────────┤
│ Bytes/Sec │ 256 kB │ 256 kB │ 749 kB │ 1.04 MB │ 766 kB  │ 237 kB │ 256 kB │
└───────────┴────────┴────────┴────────┴─────────┴─────────┴────────┴────────┘

Req/Bytes counts sampled once per second.
# of samples: 10

30k requests in 11.69s, 7.66 MB read
331 errors (331 timeouts)
[*] Stopping Express.
[*] Done. Results saved to /home/idevo/Documents/projects/XyPriss/bench/routing-bench/results/express.txt

[2/3] Running Fastify baseline...
==========================================
 Baseline: Fastify
==========================================
[*] Starting Fastify server...
[*] Waiting for port 8092...
Fastify listening on http://0.0.0.0:8092
[*] Warmup...
Running 3s test @ http://127.0.0.1:8092/api/data
10 connections


┌─────────┬──────┬──────┬───────┬──────┬─────────┬─────────┬───────┐
│ Stat    │ 2.5% │ 50%  │ 97.5% │ 99%  │ Avg     │ Stdev   │ Max   │
├─────────┼──────┼──────┼───────┼──────┼─────────┼─────────┼───────┤
│ Latency │ 0 ms │ 0 ms │ 3 ms  │ 5 ms │ 0.51 ms │ 1.77 ms │ 80 ms │
└─────────┴──────┴──────┴───────┴──────┴─────────┴─────────┴───────┘
┌───────────┬────────┬────────┬─────────┬─────────┬─────────┬──────────┬────────┐
│ Stat      │ 1%     │ 2.5%   │ 50%     │ 97.5%   │ Avg     │ Stdev    │ Min    │
├───────────┼────────┼────────┼─────────┼─────────┼─────────┼──────────┼────────┤
│ Req/Sec   │ 3 917  │ 3 917  │ 11 703  │ 12 871  │ 9 495   │ 3 972,97 │ 3 916  │
├───────────┼────────┼────────┼─────────┼─────────┼─────────┼──────────┼────────┤
│ Bytes/Sec │ 952 kB │ 952 kB │ 2.84 MB │ 3.13 MB │ 2.31 MB │ 965 kB   │ 952 kB │
└───────────┴────────┴────────┴─────────┴─────────┴─────────┴──────────┴────────┘

Req/Bytes counts sampled once per second.
# of samples: 3

28k requests in 3.06s, 6.92 MB read

--- 100 connections ---
Running 10s test @ http://127.0.0.1:8092/api/data
100 connections


┌─────────┬──────┬──────┬───────┬───────┬─────────┬─────────┬───────┐
│ Stat    │ 2.5% │ 50%  │ 97.5% │ 99%   │ Avg     │ Stdev   │ Max   │
├─────────┼──────┼──────┼───────┼───────┼─────────┼─────────┼───────┤
│ Latency │ 5 ms │ 8 ms │ 23 ms │ 27 ms │ 9.61 ms │ 4.76 ms │ 72 ms │
└─────────┴──────┴──────┴───────┴───────┴─────────┴─────────┴───────┘
┌───────────┬─────────┬─────────┬─────────┬─────────┬─────────┬─────────┬─────────┐
│ Stat      │ 1%      │ 2.5%    │ 50%     │ 97.5%   │ Avg     │ Stdev   │ Min     │
├───────────┼─────────┼─────────┼─────────┼─────────┼─────────┼─────────┼─────────┤
│ Req/Sec   │ 4 883   │ 4 883   │ 11 151  │ 11 839  │ 9 912,4 │ 2 235,8 │ 4 883   │
├───────────┼─────────┼─────────┼─────────┼─────────┼─────────┼─────────┼─────────┤
│ Bytes/Sec │ 1.19 MB │ 1.19 MB │ 2.71 MB │ 2.88 MB │ 2.41 MB │ 543 kB  │ 1.19 MB │
└───────────┴─────────┴─────────┴─────────┴─────────┴─────────┴─────────┴─────────┘

Req/Bytes counts sampled once per second.
# of samples: 10

99k requests in 10.07s, 24.1 MB read

--- 1000 connections ---
Running 10s test @ http://127.0.0.1:8092/api/data
1000 connections


┌─────────┬───────┬───────┬────────┬────────┬──────────┬──────────┬─────────┐
│ Stat    │ 2.5%  │ 50%   │ 97.5%  │ 99%    │ Avg      │ Stdev    │ Max     │
├─────────┼───────┼───────┼────────┼────────┼──────────┼──────────┼─────────┤
│ Latency │ 59 ms │ 71 ms │ 198 ms │ 369 ms │ 97.74 ms │ 76.12 ms │ 3399 ms │
└─────────┴───────┴───────┴────────┴────────┴──────────┴──────────┴─────────┘
┌───────────┬─────────┬─────────┬─────────┬─────────┬──────────┬──────────┬─────────┐
│ Stat      │ 1%      │ 2.5%    │ 50%     │ 97.5%   │ Avg      │ Stdev    │ Min     │
├───────────┼─────────┼─────────┼─────────┼─────────┼──────────┼──────────┼─────────┤
│ Req/Sec   │ 5 139   │ 5 139   │ 8 431   │ 14 791  │ 10 362,4 │ 3 416,75 │ 5 137   │
├───────────┼─────────┼─────────┼─────────┼─────────┼──────────┼──────────┼─────────┤
│ Bytes/Sec │ 1.25 MB │ 1.25 MB │ 2.05 MB │ 3.59 MB │ 2.52 MB  │ 830 kB   │ 1.25 MB │
└───────────┴─────────┴─────────┴─────────┴─────────┴──────────┴──────────┴─────────┘

Req/Bytes counts sampled once per second.
# of samples: 10

105k requests in 10.43s, 25.2 MB read

--- 5000 connections ---
Running 10s test @ http://127.0.0.1:8092/api/data
5000 connections


┌─────────┬────────┬────────┬─────────┬─────────┬───────────┬───────────┬─────────┐
│ Stat    │ 2.5%   │ 50%    │ 97.5%   │ 99%     │ Avg       │ Stdev     │ Max     │
├─────────┼────────┼────────┼─────────┼─────────┼───────────┼───────────┼─────────┤
│ Latency │ 235 ms │ 383 ms │ 1940 ms │ 2449 ms │ 494.62 ms │ 368.46 ms │ 9961 ms │
└─────────┴────────┴────────┴─────────┴─────────┴───────────┴───────────┴─────────┘
┌───────────┬─────────┬─────────┬─────────┬─────────┬───────────┬──────────┬─────────┐
│ Stat      │ 1%      │ 2.5%    │ 50%     │ 97.5%   │ Avg       │ Stdev    │ Min     │
├───────────┼─────────┼─────────┼─────────┼─────────┼───────────┼──────────┼─────────┤
│ Req/Sec   │ 7 367   │ 7 367   │ 12 799  │ 14 327  │ 11 696,67 │ 2 525,34 │ 7 366   │
├───────────┼─────────┼─────────┼─────────┼─────────┼───────────┼──────────┼─────────┤
│ Bytes/Sec │ 1.79 MB │ 1.79 MB │ 3.11 MB │ 3.48 MB │ 2.84 MB   │ 614 kB   │ 1.79 MB │
└───────────┴─────────┴─────────┴─────────┴─────────┴───────────┴──────────┴─────────┘

Req/Bytes counts sampled once per second.
# of samples: 9

110k requests in 11.87s, 25.6 MB read
[*] Stopping Fastify.
[*] Done. Results saved to /home/idevo/Documents/projects/XyPriss/bench/routing-bench/results/fastify.txt

[3/3] Running XyPriss...
==========================================
 Baseline: XyPriss (XCIS Routing)
==========================================
[*] Starting XyPriss server...
[*] Waiting for port 8093...
14:47:17.037 [SYSTEM] Creating XyPriss Server for 'port:8093'...
14:47:17.055 [SECURITY] UFSIMC-WARNING: Using generated key. For production, set ENV variables: ENC_SECRET_KEY or (ENC_SECRET_SEED and ENC_SECRET_SALT)
14:47:17.060 [SYSTEM] WorkerPool delegation to XHSC initialized
14:47:17.070 [PLUGINS] Registered plugin for 'main': xypriss::ext/xypriss::xems.core@1.1.0 [hash:xypriss::xems.core.d6fced9951]
14:47:17.075 [PLUGINS] Initializing XEMS Built-in Core Plugin...
14:47:17.075 [PLUGINS] XEMS Session Sandbox: xems.internal-session
14:47:17.085 [SYSTEM] Initializing XRMS (XyPriss Request Management System)...
14:47:17.087 [PLUGINS] Server Maintenance Plugin initialized
14:47:17.087 [PLUGINS] Plugin Manager initialized
14:47:17.087 [SYSTEM] Server plugins initialized
14:47:17.107 [PLUGINS] XEMS Core validated successfully (Ping: 31.371ms)
14:47:17.108 [SYSTEM] Starting XyPriss server on localhost:8093...
14:47:17.127 [SYSTEM] Using XHSC as primary HTTP engine
14:47:17.153 [SYSTEM] XHSC Bridge initializing...
14:47:17.177 [SYSTEM] Starting XHSC engine...
enabling perf
14:47:17.188 [SYSTEM] [INTERNAL] [XHSC] Initializing Version XHSC53026G4
14:47:17.189 [SYSTEM] [XHSC] Initializing Version XHSC53026G4
14:47:17.189 [SYSTEM] [INTERNAL] [XHSC] WARN: Failed to read /home/idevo/Documents/projects/XyPriss/bench/routing-bench/xypriss-server/xypriss.config.json: open /home/idevo/Documents/projects/XyPriss/bench/routing-bench/xypriss-server/xypriss.config.json: no such file or directory
14:47:17.189 [SYSTEM] [XHSC] WARN: Failed to read /home/idevo/Documents/projects/XyPriss/bench/routing-bench/xypriss-server/xypriss.config.json: open /home/idevo/Documents/projects/XyPriss/bench/routing-bench/xypriss-server/xypriss.config.json: no such file or directory
14:47:17.189 [SYSTEM] [INTERNAL] [SECURITY] Deep Audit complete.
14:47:17.189 [SYSTEM] [SECURITY] Deep Audit complete.
14:47:17.190 [SYSTEM] [INTERNAL] [XHSC] Connection established.
14:47:17.190 [SYSTEM] [XHSC] Connection established.
14:47:17.190 [SYSTEM] [INTERNAL] [XHSC] XHSC Edition listening on http://127.0.0.1:8093
14:47:17.190 [SYSTEM] [XHSC] XHSC Edition listening on http://127.0.0.1:8093
14:47:17.190 [SYSTEM] Single process mode: Initializing XHSC connection...
14:47:17.190 [CLUSTER] Worker master connecting to XHSC.
14:47:17.194 [CLUSTER] Worker master connected to XHSC
14:47:17.202 [SYSTEM] [default] XyPriss XHSC (Hyper-System Core) is now active and listening on http://localhost:8093
14:47:17.202 [SYSTEM] [INTERNAL] [XHSC] Worker master registered
14:47:17.202 [SYSTEM] [XHSC] Worker master registered
14:47:17.202 [SYSTEM] [INTERNAL] [XHSC] Received 10 routes from worker master
14:47:17.202 [SYSTEM] [XHSC] Received 10 routes from worker master
[*] Warmup...
Running 3s test @ http://127.0.0.1:8093/api/data
10 connections


┌─────────┬──────┬──────┬───────┬───────┬─────────┬────────┬───────┐
│ Stat    │ 2.5% │ 50%  │ 97.5% │ 99%   │ Avg     │ Stdev  │ Max   │
├─────────┼──────┼──────┼───────┼───────┼─────────┼────────┼───────┤
│ Latency │ 1 ms │ 2 ms │ 13 ms │ 14 ms │ 3.38 ms │ 3.5 ms │ 28 ms │
└─────────┴──────┴──────┴───────┴───────┴─────────┴────────┴───────┘
┌───────────┬────────┬────────┬────────┬─────────┬──────────┬──────────┬────────┐
│ Stat      │ 1%     │ 2.5%   │ 50%    │ 97.5%   │ Avg      │ Stdev    │ Min    │
├───────────┼────────┼────────┼────────┼─────────┼──────────┼──────────┼────────┤
│ Req/Sec   │ 1 194  │ 1 194  │ 1 964  │ 4 551   │ 2 569,34 │ 1 435,39 │ 1 194  │
├───────────┼────────┼────────┼────────┼─────────┼──────────┼──────────┼────────┤
│ Bytes/Sec │ 412 kB │ 412 kB │ 678 kB │ 1.57 MB │ 886 kB   │ 495 kB   │ 412 kB │
└───────────┴────────┴────────┴────────┴─────────┴──────────┴──────────┴────────┘

Req/Bytes counts sampled once per second.
# of samples: 3

8k requests in 3.03s, 2.66 MB read

--- 100 connections ---
Running 10s test @ http://127.0.0.1:8093/api/data
100 connections


┌─────────┬──────┬───────┬───────┬───────┬──────────┬─────────┬───────┐
│ Stat    │ 2.5% │ 50%   │ 97.5% │ 99%   │ Avg      │ Stdev   │ Max   │
├─────────┼──────┼───────┼───────┼───────┼──────────┼─────────┼───────┤
│ Latency │ 8 ms │ 17 ms │ 38 ms │ 43 ms │ 19.31 ms │ 8.87 ms │ 70 ms │
└─────────┴──────┴───────┴───────┴───────┴──────────┴─────────┴───────┘
┌───────────┬─────────┬─────────┬─────────┬─────────┬──────────┬──────────┬─────────┐
│ Stat      │ 1%      │ 2.5%    │ 50%     │ 97.5%   │ Avg      │ Stdev    │ Min     │
├───────────┼─────────┼─────────┼─────────┼─────────┼──────────┼──────────┼─────────┤
│ Req/Sec   │ 3 545   │ 3 545   │ 4 415   │ 7 743   │ 5 055,61 │ 1 398,67 │ 3 545   │
├───────────┼─────────┼─────────┼─────────┼─────────┼──────────┼──────────┼─────────┤
│ Bytes/Sec │ 1.23 MB │ 1.23 MB │ 1.53 MB │ 2.68 MB │ 1.75 MB  │ 483 kB   │ 1.23 MB │
└───────────┴─────────┴─────────┴─────────┴─────────┴──────────┴──────────┴─────────┘

Req/Bytes counts sampled once per second.
# of samples: 10

51k requests in 10.09s, 17.5 MB read

--- 1000 connections ---
Running 10s test @ http://127.0.0.1:8093/api/data
1000 connections


┌─────────┬────────┬────────┬────────┬────────┬───────────┬──────────┬────────┐
│ Stat    │ 2.5%   │ 50%    │ 97.5%  │ 99%    │ Avg       │ Stdev    │ Max    │
├─────────┼────────┼────────┼────────┼────────┼───────────┼──────────┼────────┤
│ Latency │ 107 ms │ 132 ms │ 327 ms │ 651 ms │ 175.03 ms │ 90.91 ms │ 753 ms │
└─────────┴────────┴────────┴────────┴────────┴───────────┴──────────┴────────┘
┌───────────┬─────────┬─────────┬─────────┬─────────┬─────────┬──────────┬─────────┐
│ Stat      │ 1%      │ 2.5%    │ 50%     │ 97.5%   │ Avg     │ Stdev    │ Min     │
├───────────┼─────────┼─────────┼─────────┼─────────┼─────────┼──────────┼─────────┤
│ Req/Sec   │ 3 573   │ 3 573   │ 4 875   │ 7 587   │ 5 804,3 │ 1 476,69 │ 3 573   │
├───────────┼─────────┼─────────┼─────────┼─────────┼─────────┼──────────┼─────────┤
│ Bytes/Sec │ 1.24 MB │ 1.24 MB │ 1.69 MB │ 2.63 MB │ 2.01 MB │ 513 kB   │ 1.24 MB │
└───────────┴─────────┴─────────┴─────────┴─────────┴─────────┴──────────┴─────────┘

Req/Bytes counts sampled once per second.
# of samples: 10

59k requests in 10.46s, 20.1 MB read

--- 5000 connections ---
Running 10s test @ http://127.0.0.1:8093/api/data
5000 connections


┌─────────┬────────┬────────┬─────────┬─────────┬───────────┬───────────┬─────────┐
│ Stat    │ 2.5%   │ 50%    │ 97.5%   │ 99%     │ Avg       │ Stdev     │ Max     │
├─────────┼────────┼────────┼─────────┼─────────┼───────────┼───────────┼─────────┤
│ Latency │ 595 ms │ 793 ms │ 1679 ms │ 1890 ms │ 866.16 ms │ 291.54 ms │ 1959 ms │
└─────────┴────────┴────────┴─────────┴─────────┴───────────┴───────────┴─────────┘
┌───────────┬─────────┬─────────┬─────────┬─────────┬──────────┬──────────┬─────────┐
│ Stat      │ 1%      │ 2.5%    │ 50%     │ 97.5%   │ Avg      │ Stdev    │ Min     │
├───────────┼─────────┼─────────┼─────────┼─────────┼──────────┼──────────┼─────────┤
│ Req/Sec   │ 4 723   │ 4 723   │ 6 551   │ 10 911  │ 6 857,34 │ 1 857,79 │ 4 721   │
├───────────┼─────────┼─────────┼─────────┼─────────┼──────────┼──────────┼─────────┤
│ Bytes/Sec │ 1.64 MB │ 1.64 MB │ 2.28 MB │ 3.78 MB │ 2.38 MB  │ 644 kB   │ 1.64 MB │
└───────────┴─────────┴─────────┴─────────┴─────────┴──────────┴──────────┴─────────┘

Req/Bytes counts sampled once per second.
# of samples: 9

67k requests in 11.86s, 21.4 MB read
[*] Stopping XyPriss.
[*] Done. Results saved to /home/idevo/Documents/projects/XyPriss/bench/routing-bench/results/xypriss.txt
14:47:54.883 [SECURITY] UFSIMC-WARNING: Using generated key. For production, set ENV variables: ENC_SECRET_KEY or (ENC_SECRET_SEED and ENC_SECRET_SALT)
14:47:54.891 [SIMC] XyPriss SIMC shutdown completed successfully
14:47:54.892 [SYSTEM] Bridge: Stopping XHSC engine (P235309)...
SIMC closed
14:47:54.893 [SYSTEM] Server stopped successfully

##############################################
  All benchmarks complete.
  Results saved in: results/
    - results/express.txt
    - results/fastify.txt
    - results/xypriss.txt
##############################################
                                                                                                        
┌──(idevo㉿
