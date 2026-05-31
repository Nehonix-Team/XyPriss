
Logs "                                                                                                                                                                                           
┌──(idevo㉿ll)-[~/Documents/projects/XyPriss]
└─$ xfpm run XCIS:bench.xstatic
  [*]   Running script: XCIS:bench.xstatic
==========================================
 XyPriss Fast Path Benchmark (autocannon)
==========================================
[*] Nettoyage des anciens processus...
[*] Démarrage du serveur XCIS...
[*] En attente que le port 8085 soit prêt...
[*] Warmup rapide (évite le cold start dans les stats)...
Running 3s test @ http://127.0.0.1:8085/static/texte.txt
10 connections


┌─────────┬──────┬──────┬───────┬───────┬────────┬──────────┬────────┐
│ Stat    │ 2.5% │ 50%  │ 97.5% │ 99%   │ Avg    │ Stdev    │ Max    │
├─────────┼──────┼──────┼───────┼───────┼────────┼──────────┼────────┤
│ Latency │ 0 ms │ 1 ms │ 12 ms │ 20 ms │ 2.9 ms │ 23.57 ms │ 705 ms │
└─────────┴──────┴──────┴───────┴───────┴────────┴──────────┴────────┘
┌───────────┬────────┬────────┬────────┬─────────┬──────────┬──────────┬────────┐
│ Stat      │ 1%     │ 2.5%   │ 50%    │ 97.5%   │ Avg      │ Stdev    │ Min    │
├───────────┼────────┼────────┼────────┼─────────┼──────────┼──────────┼────────┤
│ Req/Sec   │ 631    │ 631    │ 1 694  │ 6 507   │ 2 943,67 │ 2 556,06 │ 631    │
├───────────┼────────┼────────┼────────┼─────────┼──────────┼──────────┼────────┤
│ Bytes/Sec │ 139 kB │ 139 kB │ 353 kB │ 1.35 MB │ 615 kB   │ 529 kB   │ 139 kB │
└───────────┴────────┴────────┴────────┴─────────┴──────────┴──────────┴────────┘

Req/Bytes counts sampled once per second.
# of samples: 3

8198 2xx responses, 631 non 2xx responses
9k requests in 3.1s, 1.84 MB read
[*] Lancement du benchmark principal...

--- Test avec 100 connexions ---
Running 15s test @ http://127.0.0.1:8085/static/texte.txt
100 connections


┌─────────┬──────┬──────┬───────┬───────┬──────────┬─────────┬────────┐
│ Stat    │ 2.5% │ 50%  │ 97.5% │ 99%   │ Avg      │ Stdev   │ Max    │
├─────────┼──────┼──────┼───────┼───────┼──────────┼─────────┼────────┤
│ Latency │ 5 ms │ 9 ms │ 30 ms │ 45 ms │ 11.73 ms │ 9.64 ms │ 179 ms │
└─────────┴──────┴──────┴───────┴───────┴──────────┴─────────┴────────┘
┌───────────┬────────┬────────┬─────────┬─────────┬─────────┬──────────┬────────┐
│ Stat      │ 1%     │ 2.5%   │ 50%     │ 97.5%   │ Avg     │ Stdev    │ Min    │
├───────────┼────────┼────────┼─────────┼─────────┼─────────┼──────────┼────────┤
│ Req/Sec   │ 1 788  │ 1 788  │ 8 919   │ 10 655  │ 8 278,4 │ 2 202,32 │ 1 788  │
├───────────┼────────┼────────┼─────────┼─────────┼─────────┼──────────┼────────┤
│ Bytes/Sec │ 372 kB │ 372 kB │ 1.86 MB │ 2.22 MB │ 1.72 MB │ 458 kB   │ 372 kB │
└───────────┴────────┴────────┴─────────┴─────────┴─────────┴──────────┴────────┘

Req/Bytes counts sampled once per second.
# of samples: 15

124k requests in 15.31s, 25.8 MB read

--- Test avec 500 connexions ---
Running 15s test @ http://127.0.0.1:8085/static/texte.txt
500 connections


┌─────────┬───────┬───────┬────────┬────────┬──────────┬──────────┬────────┐
│ Stat    │ 2.5%  │ 50%   │ 97.5%  │ 99%    │ Avg      │ Stdev    │ Max    │
├─────────┼───────┼───────┼────────┼────────┼──────────┼──────────┼────────┤
│ Latency │ 31 ms │ 58 ms │ 147 ms │ 203 ms │ 70.33 ms │ 52.62 ms │ 773 ms │
└─────────┴───────┴───────┴────────┴────────┴──────────┴──────────┴────────┘
┌───────────┬────────┬────────┬─────────┬─────────┬──────────┬──────────┬────────┐
│ Stat      │ 1%     │ 2.5%   │ 50%     │ 97.5%   │ Avg      │ Stdev    │ Min    │
├───────────┼────────┼────────┼─────────┼─────────┼──────────┼──────────┼────────┤
│ Req/Sec   │ 2 000  │ 2 000  │ 7 491   │ 10 439  │ 7 406,14 │ 1 918,22 │ 2 000  │
├───────────┼────────┼────────┼─────────┼─────────┼──────────┼──────────┼────────┤
│ Bytes/Sec │ 416 kB │ 416 kB │ 1.56 MB │ 2.17 MB │ 1.54 MB  │ 399 kB   │ 416 kB │
└───────────┴────────┴────────┴─────────┴─────────┴──────────┴──────────┴────────┘

Req/Bytes counts sampled once per second.
# of samples: 15

112k requests in 16.11s, 23.1 MB read

--- Test avec 1000 connexions ---
Running 15s test @ http://127.0.0.1:8085/static/texte.txt
1000 connections


┌─────────┬───────┬────────┬────────┬────────┬───────────┬──────────┬────────┐
│ Stat    │ 2.5%  │ 50%    │ 97.5%  │ 99%    │ Avg       │ Stdev    │ Max    │
├─────────┼───────┼────────┼────────┼────────┼───────────┼──────────┼────────┤
│ Latency │ 71 ms │ 124 ms │ 327 ms │ 504 ms │ 149.48 ms │ 93.17 ms │ 982 ms │
└─────────┴───────┴────────┴────────┴────────┴───────────┴──────────┴────────┘
┌───────────┬────────┬────────┬─────────┬─────────┬──────────┬──────────┬────────┐
│ Stat      │ 1%     │ 2.5%   │ 50%     │ 97.5%   │ Avg      │ Stdev    │ Min    │
├───────────┼────────┼────────┼─────────┼─────────┼──────────┼──────────┼────────┤
│ Req/Sec   │ 2 000  │ 2 000  │ 6 995   │ 11 007  │ 7 407,29 │ 2 220,63 │ 2 000  │
├───────────┼────────┼────────┼─────────┼─────────┼──────────┼──────────┼────────┤
│ Bytes/Sec │ 416 kB │ 416 kB │ 1.46 MB │ 2.29 MB │ 1.54 MB  │ 462 kB   │ 416 kB │
└───────────┴────────┴────────┴─────────┴─────────┴──────────┴──────────┴────────┘

Req/Bytes counts sampled once per second.
# of samples: 14

105k requests in 15.84s, 21.6 MB read

--- Test avec 2000 connexions ---
Running 15s test @ http://127.0.0.1:8085/static/texte.txt
2000 connections

running [====                ] 20%
┌─────────┬────────┬────────┬────────┬─────────┬───────────┬───────────┬─────────┐
│ Stat    │ 2.5%   │ 50%    │ 97.5%  │ 99%     │ Avg       │ Stdev     │ Max     │
├─────────┼────────┼────────┼────────┼─────────┼───────────┼───────────┼─────────┤
│ Latency │ 142 ms │ 245 ms │ 509 ms │ 1145 ms │ 282.13 ms │ 163.82 ms │ 1678 ms │
└─────────┴────────┴────────┴────────┴─────────┴───────────┴───────────┴─────────┘
┌───────────┬─────────┬─────────┬─────────┬─────────┬─────────┬───────┬─────────┐
│ Stat      │ 1%      │ 2.5%    │ 50%     │ 97.5%   │ Avg     │ Stdev │ Min     │
├───────────┼─────────┼─────────┼─────────┼─────────┼─────────┼───────┼─────────┤
│ Req/Sec   │ 49 151  │ 49 151  │ 49 151  │ 49 151  │ 49 136  │ 0     │ 49 137  │
├───────────┼─────────┼─────────┼─────────┼─────────┼─────────┼───────┼─────────┤
│ Bytes/Sec │ 10.2 MB │ 10.2 MB │ 10.2 MB │ 10.2 MB │ 10.2 MB │ 0 B   │ 10.2 MB │
└───────────┴─────────┴─────────┴─────────┴─────────┴─────────┴───────┴─────────┘

Req/Bytes counts sampled once per second.
# of samples: 3

149k requests in 21.35s, 30.7 MB read
[*] Benchmark terminé. Arrêt du serveur XCIS.
[*] Terminé.
                                                                                                                                                                                              
┌──(idevo㉿ll)-[~/Documents/projects/XyPriss]
└─$ 

(idevo㉿ll)-[~/Documents/projects/XyPriss]
└─$ # 1. Voir tous les process qui tournent pendant le bench
ps aux | grep -E "bun|go|xhsc|xcis|xypriss" --color

# 2. Ou lister tout ce qui écoute sur 8085
ss -tlnp | grep 8085

# 3. Ou voir l'arbre des process lancés par bun
pstree -p $(pgrep bun)
idevo       3656  0.0  0.1 518836 26152 ?        Sl   19:09   0:00 /usr/libexec/goa-daemon
idevo       3684  0.0  0.0 388012 10060 ?        Sl   19:09   0:00 /usr/libexec/goa-identity-service
idevo       3699  0.0  0.0 308044  7184 ?        Ssl  19:09   0:00 /usr/libexec/gvfs-goa-volume-monitor
idevo       4677  0.0  0.3 33820592 51948 ?      S    19:10   0:00 /usr/share/antigravity/antigravity --type=zygote --no-zygote-sandbox
idevo       4678  0.0  0.3 33820576 51820 ?      S    19:10   0:00 /usr/share/antigravity/antigravity --type=zygote
idevo       4680  0.0  0.0 33820600 13428 ?      S    19:10   0:00 /usr/share/antigravity/antigravity --type=zygote
idevo       4720 38.2  1.1 34395772 179944 ?     Sl   19:10  45:49 /usr/share/antigravity/antigravity --type=zygote --no-zygote-sandbox
idevo       4844 50.2  7.4 1466561868 1202524 ?  Sl   19:10  60:06 /usr/share/antigravity/antigravity --type=zygote
idevo       4973  0.1  1.0 1459609068 176724 ?   Sl   19:10   0:08 /usr/share/antigravity/antigravity --type=zygote
idevo       5216  7.1  2.1 5318828 342152 ?      Rl   19:10   8:32 /usr/share/antigravity/resources/app/extensions/antigravity/bin/language_server_linux_x64 --csrf_token 2d584b35-26bc-4362-8b22-783b32b5eb81 --extension_server_port 44847 --extension_server_csrf_token be9b4c83-7253-4894-bdb2-e9f1e15ff3c2 --app_data_dir antigravity --cloud_code_endpoint https://cloudcode-pa.googleapis.com
idevo       8334  0.6  1.2 2439476 197656 ?      Sl   19:10   0:44 /home/idevo/go/bin/gopls
idevo       8345  0.0  0.1 1651096 28144 ?       Ssl  19:10   0:00 /home/idevo/go/bin/gopls ** telemetry **
idevo     141651  5.6  1.8 5170304 301144 ?      Sl   20:19   2:50 /usr/share/antigravity/resources/app/extensions/antigravity/bin/language_server_linux_x64 --enable_lsp --csrf_token a3d4d8ff-0575-4fab-a8d4-23932ff5642d --extension_server_port 36345 --extension_server_csrf_token 2d8e8473-3818-4f5c-ba57-7242fa9121ea --https_server_port 45019 --lsp_port 36871 --workspace_id file_home_idevo_Documents_projects_XyPriss --cloud_code_endpoint https://daily-cloudcode-pa.googleapis.com --app_data_dir antigravity --parent_pipe_path /tmp/server_74bebb5d71d0334a
idevo     155364  0.0  0.0 1338528 11024 ?       Sl   20:26   0:00 /tmp/go-build562747966/b001/exe/test_server
idevo     222423  7.4  4.2 51801592 688956 ?     SLl  21:01   0:36 /opt/google/chrome/chrome
idevo     222431  0.0  0.0 50354728 4188 ?       Sl   21:01   0:00 /opt/google/chrome/chrome_crashpad_handler --monitor-self --monitor-self-annotation=ptype=crashpad-handler --database=/home/idevo/.config/google-chrome/Crash Reports --metrics-dir=/home/idevo/.config/google-chrome --url=https://clients2.google.com/cr/report --annotation=channel= --annotation=lsb-release=Kali GNU/Linux Rolling --annotation=plat=Linux --annotation=prod=Chrome_Linux --annotation=ver=148.0.7778.167 --initial-client-fd=5 --shared-client-connection
idevo     222433  0.0  0.0 50345492 3592 ?       Sl   21:01   0:00 /opt/google/chrome/chrome_crashpad_handler --no-periodic-tasks --monitor-self-annotation=ptype=crashpad-handler --database=/home/idevo/.config/google-chrome/Crash Reports --url=https://clients2.google.com/cr/report --annotation=channel= --annotation=lsb-release=Kali GNU/Linux Rolling --annotation=plat=Linux --annotation=prod=Chrome_Linux --annotation=ver=148.0.7778.167 --initial-client-fd=4 --shared-client-connection
idevo     222439  0.0  0.4 50752236 69224 ?      S    21:01   0:00 /opt/google/chrome/chrome --type=zygote --no-zygote-sandbox --crashpad-handler-pid=222431 --enable-crash-reporter=843fb0a5-c81e-42ad-ab5f-352444b5f846, --change-stack-guard-on-fork=enable
idevo     222440  0.0  0.4 50752228 71336 ?      S    21:01   0:00 /opt/google/chrome/chrome --type=zygote --crashpad-handler-pid=222431 --enable-crash-reporter=843fb0a5-c81e-42ad-ab5f-352444b5f846, --change-stack-guard-on-fork=enable
idevo     222461  0.0  0.1 50752256 22816 ?      S    21:01   0:00 /opt/google/chrome/chrome --type=zygote --crashpad-handler-pid=222431 --enable-crash-reporter=843fb0a5-c81e-42ad-ab5f-352444b5f846, --change-stack-guard-on-fork=enable
idevo     222516 44.5  1.2 51251284 194848 ?     Sl   21:01   3:36 /opt/google/chrome/chrome --type=gpu-process --ozone-platform=x11 --crashpad-handler-pid=222431 --enable-crash-reporter=843fb0a5-c81e-42ad-ab5f-352444b5f846, --change-stack-guard-on-fork=enable --gpu-preferences=UAAAAAAAAAAgAQAEAAAAAAAAAAAAAGAAAQAAAAAAAAAAAAAAAAAAAAIAAAAAAAAAAAAAAAAAAAAYAAAAAAAAABgAAAAAAAAAAQAAAAAAAAAIAAAAAAAAAAgAAAAAAAAA --shared-files --metrics-shmem-handle=4,i,9442520330649537699,6557196285998121010,262144 --field-trial-handle=3,i,15644230967067979186,17980800712621189002,262144 --variations-seed-version=20260530-030043.971000-production --pseudonymization-salt-handle=7,i,6406429964863474286,5741616510576849739,4 --trace-process-track-uuid=3190708988185955192
idevo     222517  1.4  0.8 50773628 141008 ?     Sl   21:01   0:07 /opt/google/chrome/chrome --type=utility --utility-sub-type=network.mojom.NetworkService --lang=fr --service-sandbox-type=none --crashpad-handler-pid=222431 --enable-crash-reporter=843fb0a5-c81e-42ad-ab5f-352444b5f846, --change-stack-guard-on-fork=enable --shared-files=v8_context_snapshot_data:100 --metrics-shmem-handle=4,i,17409546448133138294,1190474819949782571,524288 --field-trial-handle=3,i,15644230967067979186,17980800712621189002,262144 --variations-seed-version=20260530-030043.971000-production --pseudonymization-salt-handle=7,i,6406429964863474286,5741616510576849739,4 --trace-process-track-uuid=3190708989122997041
idevo     222556  0.0  0.3 50810676 63360 ?      Sl   21:01   0:00 /opt/google/chrome/chrome --type=utility --utility-sub-type=storage.mojom.StorageService --lang=fr --service-sandbox-type=utility --crashpad-handler-pid=222431 --enable-crash-reporter=843fb0a5-c81e-42ad-ab5f-352444b5f846, --change-stack-guard-on-fork=enable --shared-files=v8_context_snapshot_data:100 --metrics-shmem-handle=4,i,8135182571096988149,12169344610174225745,524288 --field-trial-handle=3,i,15644230967067979186,17980800712621189002,262144 --variations-seed-version=20260530-030043.971000-production --pseudonymization-salt-handle=7,i,6406429964863474286,5741616510576849739,4 --trace-process-track-uuid=3190708990060038890
idevo     222713  0.1  0.7 1520465444 126612 ?   Sl   21:01   0:00 /opt/google/chrome/chrome --type=renderer --crashpad-handler-pid=222431 --enable-crash-reporter=843fb0a5-c81e-42ad-ab5f-352444b5f846, --extension-process --origin-trial-disabled-features=CanvasTextNg|WebAssemblyCustomDescriptors --change-stack-guard-on-fork=enable --ozone-platform=x11 --lang=fr --num-raster-threads=4 --enable-main-frame-before-activation --renderer-client-id=9 --time-ticks-at-unix-epoch=-1780168132235118 --launch-time-ticks=6778586193 --shared-files=v8_context_snapshot_data:100 --metrics-shmem-handle=4,i,15086938003215825533,16713888715327675026,2097152 --field-trial-handle=3,i,15644230967067979186,17980800712621189002,262144 --variations-seed-version=20260530-030043.971000-production --pseudonymization-salt-handle=7,i,6406429964863474286,5741616510576849739,4 --trace-process-track-uuid=3190708994745248135
idevo     222784 47.0  2.9 1520667996 473600 ?   Sl   21:01   3:46 /opt/google/chrome/chrome --type=renderer --crashpad-handler-pid=222431 --enable-crash-reporter=843fb0a5-c81e-42ad-ab5f-352444b5f846, --origin-trial-disabled-features=CanvasTextNg|WebAssemblyCustomDescriptors --change-stack-guard-on-fork=enable --ozone-platform=x11 --lang=fr --num-raster-threads=4 --enable-main-frame-before-activation --renderer-client-id=11 --time-ticks-at-unix-epoch=-1780168132235118 --launch-time-ticks=6779257881 --shared-files=v8_context_snapshot_data:100 --metrics-shmem-handle=4,i,4871110721150637869,16221325135282789744,2097152 --field-trial-handle=3,i,15644230967067979186,17980800712621189002,262144 --variations-seed-version=20260530-030043.971000-production --pseudonymization-salt-handle=7,i,6406429964863474286,5741616510576849739,4 --trace-process-track-uuid=3190708996619331833
idevo     222900  0.0  0.4 1518445324 79124 ?    Sl   21:01   0:00 /opt/google/chrome/chrome --type=renderer --crashpad-handler-pid=222431 --enable-crash-reporter=843fb0a5-c81e-42ad-ab5f-352444b5f846, --origin-trial-disabled-features=CanvasTextNg|WebAssemblyCustomDescriptors --change-stack-guard-on-fork=enable --ozone-platform=x11 --lang=fr --num-raster-threads=4 --enable-main-frame-before-activation --renderer-client-id=14 --time-ticks-at-unix-epoch=-1780168132235118 --launch-time-ticks=6783734930 --shared-files=v8_context_snapshot_data:100 --metrics-shmem-handle=4,i,13303512765542691563,11211784640709297107,2097152 --field-trial-handle=3,i,15644230967067979186,17980800712621189002,262144 --variations-seed-version=20260530-030043.971000-production --pseudonymization-salt-handle=7,i,6406429964863474286,5741616510576849739,4 --trace-process-track-uuid=3190708999430457380
idevo     223002  0.0  0.5 50801584 84008 ?      Sl   21:01   0:00 /opt/google/chrome/chrome --type=utility --utility-sub-type=audio.mojom.AudioService --lang=fr --service-sandbox-type=none --crashpad-handler-pid=222431 --enable-crash-reporter=843fb0a5-c81e-42ad-ab5f-352444b5f846, --change-stack-guard-on-fork=enable --shared-files=v8_context_snapshot_data:100 --metrics-shmem-handle=4,i,6491101863689589566,16764055919295491745,524288 --field-trial-handle=3,i,15644230967067979186,17980800712621189002,262144 --variations-seed-version=20260530-030043.971000-production --pseudonymization-salt-handle=7,i,6406429964863474286,5741616510576849739,4 --trace-process-track-uuid=3190709000367499229
idevo     234990  6.2  0.5 74364804 88404 pts/5  Sl+  21:08   0:03 bun run ./src/server.ts
idevo     235240  174  0.3 2091420 53012 ?       Ssl  21:08   1:36 /home/idevo/Documents/projects/XyPriss/bin/xhsc-linux-amd64 --signature 1cab13b81d3fab2e9741f20835a78752ac9808a9e01bd80556a4ec09c81c9d8a77d4fec3f593f52882c92784d8ace38222c4a8a5de29cdf15e407cf1c74ded76 server start --port 8085 --host 127.0.0.1 --ipc /tmp/nehonix.xypriss.data/.xhsc/xhsc-019e7ab7f784-dlR5RHZV.sock --timeout 32 --max-body-size 10485760 --perf-compression=true --perf-compression-algs gzip,br,deflate,zstd --compression-level 6 --compression-threshold 1024 --compression-types text/html,text/css,text/javascript,application/javascript,application/json,application/xml,text/xml,text/plain,image/svg+xml --perf-batch-size 100 --perf-connection-pooling=true --http2-max-streams 100 --keepalive-timeout 65000 --keepalive-requests 100 --pool-timeout 30000 --pool-idle-timeout 60000 --trust-proxy  --cluster --cluster-workers 10 --cluster-respawn true --entry-point /home/idevo/Documents/projects/XyPriss/simulations/XCIS/src/server.ts --intelligence --pre-allocate --rescue-mode true --worker-pool --worker-pool-max-tasks 1 --worker-pool-cpu-min 10 --worker-pool-cpu-max 30 --worker-pool-io-min 10 --worker-pool-io-max 30 --project-root /home/idevo/Documents/projects/XyPriss/simulations/XCIS
idevo     235247  4.0  0.5 74364800 84464 ?      Sl   21:08   0:02 /home/idevo/.xfpm/bin/bun --profile /home/idevo/Documents/projects/XyPriss/simulations/XCIS/src/server.ts
idevo     235249  4.1  0.5 74364800 84188 ?      Sl   21:08   0:02 /home/idevo/.xfpm/bin/bun --profile /home/idevo/Documents/projects/XyPriss/simulations/XCIS/src/server.ts
idevo     235251  4.1  0.5 74364800 84992 ?      Sl   21:08   0:02 /home/idevo/.xfpm/bin/bun --profile /home/idevo/Documents/projects/XyPriss/simulations/XCIS/src/server.ts
idevo     235253  3.9  0.5 74364800 86120 ?      Sl   21:08   0:02 /home/idevo/.xfpm/bin/bun --profile /home/idevo/Documents/projects/XyPriss/simulations/XCIS/src/server.ts
idevo     235254  4.2  0.5 74364796 84804 ?      Sl   21:08   0:02 /home/idevo/.xfpm/bin/bun --profile /home/idevo/Documents/projects/XyPriss/simulations/XCIS/src/server.ts
idevo     235256  4.1  0.5 74364800 85492 ?      Sl   21:08   0:02 /home/idevo/.xfpm/bin/bun --profile /home/idevo/Documents/projects/XyPriss/simulations/XCIS/src/server.ts
idevo     235262  4.2  0.5 74364860 85396 ?      Sl   21:08   0:02 /home/idevo/.xfpm/bin/bun --profile /home/idevo/Documents/projects/XyPriss/simulations/XCIS/src/server.ts
idevo     235265  4.1  0.5 74364796 86184 ?      Sl   21:08   0:02 /home/idevo/.xfpm/bin/bun --profile /home/idevo/Documents/projects/XyPriss/simulations/XCIS/src/server.ts
idevo     235268  3.9  0.5 74332092 84368 ?      Sl   21:08   0:02 /home/idevo/.xfpm/bin/bun --profile /home/idevo/Documents/projects/XyPriss/simulations/XCIS/src/server.ts
idevo     235269  4.0  0.5 74364800 85536 ?      Sl   21:08   0:02 /home/idevo/.xfpm/bin/bun --profile /home/idevo/Documents/projects/XyPriss/simulations/XCIS/src/server.ts
idevo     238859  0.0  0.0   6560  2452 pts/4    S+   21:09   0:00 grep --color=auto -E bun|go|xhsc|xcis|xypriss --color
LISTEN 0      4096       127.0.0.1:8085       0.0.0.0:*    users:(("xhsc-linux-amd6",pid=235240,fd=32))
Usage: pstree [-acglpsStTuZ] [ -h | -H PID ] [ -n | -N type ]
              [ -A | -G | -U ] [ PID | UTILISATEUR ]
   ou: pstree -V

Affiche un arbre des processus.

  -a, --arguments     montrer les arguments de la ligne de commande
  -A, --ascii         utiliser les caractères de dessin de lignes ASCII
  -c, --compact-not   ne pas compacter des sous-arbres identiques
  -C, --color=TYPE    coloriser les processus par attribut
                      (age)
  -g, --show-pgids    montrer les ids de groupes de processus ; implique -c
  -G, --vt100         utiliser les caractères de dessin de lignes du VT100
  -h, --highlight-all mettre en évidence le processus courant et ses ancêtres
  -H PID, --highlight-pid=PID
                      mettre en évidence ce processus et ses ancêtres
  -l, --long          ne pas tronquer les longues lignes
  -n, --numeric-sort  trier la sortie par PID
  -N TYPE, --ns-sort=TYPE
                      trier la sortie par ce type d'espace de noms
                              (cgroup, ipc, mnt, net, pid, time, user, uts)
  -p, --show-pids     montrer les PID ; implique -c
  -s, --show-parents  montrer les parents du processus sélectionné
  -S, --ns-changes    montrer les transitions d'espaces de noms
  -t, --thread-names  montrer les noms complets des threads
  -T, --hide-threads  cacher les threads, montrer uniquement les processus
  -u, --uid-changes   montrer les transitions de UID
  -U, --unicode       utiliser les caractères UTF-8 (Unicode) pour dessiner les lignes
  -V, --version       afficher les informations de la version
  -Z, --security-context
                      montre les attributs de sécurité

  PID    commence à ce PID; le défaut est 1 (init)
  USER   montre seulement les arbres nichés aux processus de cet utilisateur

                                                                                
┌──(idevo㉿ll)-[~/Documents/proje"
## 🔍 Architecture révélée — tout s'explique maintenant

### Ce que le `ps aux` montre

**Le vrai orchestrateur c'est Go, pas Bun :**

```
pid=235240  xhsc-linux-amd64  CPU: 174%  ← Go, écoute sur :8085
pid=235247..235269  bun --profile  ×10   ← 10 workers Bun (~4% CPU chacun)
```

```
LISTEN 127.0.0.1:8085  →  xhsc-linux-amd64 (pid=235240)
```

**Go reçoit toutes les requêtes HTTP et dispatche vers les workers Bun via IPC socket.**

---

### Les flags Go sont très parlants

```bash
--cluster --cluster-workers 10        # 10 workers Bun
--perf-compression=true               # gzip/br/deflate/zstd actif
--compression-threshold 1024          # compresse si > 1KB
--http2-max-streams 100
--keepalive-timeout 65000
--perf-batch-size 100
--worker-pool-max-tasks 1             # ⚠️ 1 tâche par worker à la fois
```

---

### 🎯 Causes identifiées des problèmes

**1. `--worker-pool-max-tasks 1` — bottleneck majeur**

Chaque worker Bun ne traite qu'**une tâche à la fois**. Avec 10 workers → max 10 requêtes en traitement simultané côté Bun, tout le reste attend dans la queue Go. C'est la cause directe du plateau à ~10k req/sec.

**2. Compression active sur `texte.txt`**

```bash
--compression-threshold 1024
--compression-types ... text/plain ...
```

Si `texte.txt` > 1KB, Go compresse chaque réponse. Pour un bench de fichier statique c'est un overhead pur — et ça explique le CPU à 174% sur Go seul.

**3. Le 49k req/sec à 2000 connexions est confirmé invalide**

Go sature, commence à rejeter des connexions TCP, autocannon les compte quand même. Les `# of samples: 3` + `running [====] 20%` confirment que le test ne s'est pas terminé.

---

### ✅ Tests à faire maintenant

```bash
# Désactiver la compression pour le bench static
# (ajouter ce flag au lancement xhsc)
--perf-compression=false

# Augmenter les tâches par worker
--worker-pool-max-tasks 10

# Augmenter les workers
--cluster-workers 20  # si tu as assez de CPU
```

Et pour vérifier le vrai CPU pendant le bench :
```bash
pidstat -u -p 235240,235247,235249,235251,235253 1 20
# (les PIDs des process Go + Bun workers)
```

---

### Résumé de l'architecture

```
autocannon
    │ HTTP
    ▼
xhsc-linux-amd64 (Go)  ← port 8085, routing, compression, pooling
    │ IPC Unix socket
    ▼
[bun worker ×10]  ← logique applicative TS, 1 tâche/worker max
```

Le vrai plafond théorique avec `--worker-pool-max-tasks 1` et 10 workers est environ `10 × latence_IPC`. Si l'IPC prend ~1ms → ~10k req/sec. Ce qui colle exactement avec tes mesures.