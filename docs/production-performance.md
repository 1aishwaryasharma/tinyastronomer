# Deployed website performance

Tested https://tinyastronomer.com/ on September 7, 2026, at 09:01–09:05 UTC.

## Method

Lighthouse 13.4.1, Headless Chrome 152, running locally against the public HTTPS
site. Audits ran sequentially. Mobile uses Lighthouse simulated throttling:
150 ms RTT, 1,638.4 Kbps throughput, 4× CPU slowdown. Desktop uses the desktop
preset (40 ms RTT, 10,240 Kbps, 1× CPU). These are lab measurements, not real-user
Core Web Vitals or measurements on a physical phone. The graphics environment
and shader/cache warmup can affect WebGL results.

The deployed frame-loop.js matched the local optimized file byte for byte.
Production HTML includes the new module URLs and Three.js preloads; the
Lighthouse network log confirms the lossless WebP night-lights texture.

## Results

| Page / profile | Performance / 100 | LCP | Blocking time (TBT) | CLS | Transfer |
| --- | ---: | ---: | ---: | ---: | ---: |
| Home — mobile (median of 3) | 64 | 3.5 s | 1041 ms | 0.000 | 2.51 MiB |
| home-desktop | 84 | 1.8 s | 49 ms | 0.000 | 2.52 MiB |
| solar-system-mobile | 50 | 3.9 s | 2479 ms | 0.002 | 4.22 MiB |
| seasons-mobile | 47 | 4.5 s | 1387 ms | 0.000 | 0.87 MiB |
| scale-walk-mobile | 57 | 3.6 s | 1318 ms | 0.000 | 1.70 MiB |
| sky-tonight-mobile | 87 | 3.2 s | 0 ms | 0.000 | 0.17 MiB |
| missions-mobile | 85 | 3.2 s | 0 ms | 0.089 | 0.17 MiB |

Home mobile scores were **43, 64, and 71**; LCP was **4.7, 3.5, and 3.5 s**;
TBT was **10,400, 1,040, and 590 ms**. The table uses the median of each metric.
Other pages have one completed audit each; their scores are indicative.
All completed reports have no Lighthouse run warnings. Two CLI runs emitted
a temporary Chrome profile cleanup error after producing their reports;
report completeness and metrics were checked separately.

## Findings

1. **Mobile 3D startup remains the main bottleneck.** The earlier optimizations
   improved steady rendering work, but do not establish fast initial loading.
   Lighthouse attributes substantial execution time to callbacks invoked by
   frame-loop.js. That attribution includes the scene rendering work invoked
   by the scheduler; it does not establish that the scheduler itself is slow.
   The large first-run outlier needs targeted profiling to separate shader
   compilation, texture upload, scene construction, and rendering cost.
2. **The landing page still transfers roughly 2.5 MiB**, including about
   559 KiB of Moon textures even while displaying the Earth preview. Defer
   non-preview assets and scene initialization until the Light Study opens;
   measure LCP and TBT again after changing the loading boundary. Grand Tour
   transfers roughly 4.2 MiB and is another candidate for staged loading.
3. **Fonts and CSS delay initial paint.** Lighthouse flags Google Fonts CSS and
   the shared stylesheets as render blocking. The first home run estimated
   1.78 s of potential savings, an estimate rather than a guaranteed gain.
   Evaluate local/subset fonts and critical CSS with before/after audits.
4. **The server was responsive from this test location.** Three compressed
   HTTP GETs per page all returned 200. Median HTML TTFB ranged from 115 ms
   (Missions) to 219 ms (Seasons); home median was 140 ms. This is not a global
   CDN benchmark. Response compression is active.
5. **Layout is mostly stable.** Home and most studies had zero CLS; Grand Tour
   had 0.002 and Missions had 0.089.

## Artifacts and reproduction

The local, gitignored artifacts/production-perf directory contains the HTML
and JSON reports, summary.json, and the HTTP samples in http.json.

```sh
npx --yes lighthouse https://tinyastronomer.com/ \
  --only-categories=performance --output=json --output=html \
  --output-path=artifacts/production-perf/home-mobile \
  --chrome-flags='--headless --no-sandbox' --quiet
```

Add --preset=desktop for the desktop profile. No application code or production
configuration was changed during this deployed-site audit.
