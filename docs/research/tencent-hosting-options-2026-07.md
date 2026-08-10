# Tencent Cloud options for the July 2026 migration

Research date: 2026-07-19. Scope: a small production Next.js/Node site with
PostgreSQL on the same host, moving from the existing single-Droplet setup.
This is a pricing/promotion investigation, not a migration runbook.

## Recommendation

Use the three-month **Lighthouse General Linux 2C2G 30M30G** offer for a
time-limited production evaluation *if the logged-in purchase page still shows
Singapore and a known paid renewal price*. It is the closer fit for the
current one-server architecture: one simple, prepaid bundle, automatic public
networking, 2 vCPU/2 GB RAM, and materially better web egress than 1 Mbps.

It is only a cautious fit: 2 GB RAM is the minimum for Node plus PostgreSQL,
not comfortable headroom for builds, spikes, or a growing database. Do not
allow the trial to be the only database-protection plan. Make an off-host
logical PostgreSQL backup and perform a restore test before cutover.

Choose **CVM S5 2C4G** instead if 4 GB RAM, independent disk/network choices,
or later expansion into VPC/EIP/managed services matters more than a simpler
bundle. A 1 Mbps public link is a poor default for a public website; verify
whether it is a promotional inclusion and its paid rate before accepting it.

## What Tencent's current Free Tier page verifies

Tencent's public [Free Tier page](https://www.tencentcloud.com/act/pro/FreeTier)
contains the offer metadata below when viewed anonymously on 2026-07-19. The
same page is dynamic, so the logged-in order page is the final authority.

| Offer shown by Free Tier | Confirmed configuration | Region / term | Important interpretation |
| --- | --- | --- | --- |
| Lighthouse General Linux `2C2G 30M30G` | 2 vCPU, 2 GB RAM, **30 Mbps outbound cap**, 30 GB `CLOUD_SSD` system disk, and **1,024 GB monthly traffic** | Singapore, Silicon Valley, Tokyo, Frankfurt, Seoul, Jakarta, and Hong Kong (China); **3 months** | `30M` is bandwidth and the final `30G` is the system disk. It does **not** mean 30 GB traffic: the SKU metadata separately sets monthly traffic to 1,024 GB. |
| CVM Standard `S5 2C4G` | 2 vCPU, 4 GB RAM; public image only; Balanced SSD CBS system disk; no data disk; selectable system disk 20–50 GB (20 GB default) | **3 months**; the anonymous metadata lists eligible numeric regions/AZs but does not name them | The public Free Tier data confirms the compute/disk restrictions and term, but does **not** expose a 1 Mbps field or map the numeric region IDs to Singapore. Treat “Singapore, 1 Mbps” as unverified until the signed-in order summary states it. |

Both entries carry `registered`, `no_paid_deal`, and `restricted_by` eligibility
flags, a one-per-user limit, and stock/campaign limits in the page data. Tencent
does not publish a plain-language legend for all of those fields on the public
page. The safe reading is therefore: sign in, complete any required account or
identity checks, and confirm the eligibility result; do not assume that an old
or already-paying account qualifies.

## Trial, expiry, renewal, and price

- The current Free Tier metadata fixes both offers to a three-month purchase
  term. It is a promotional order, not evidence of an automatically renewable
  free service.
- The public page provided no anonymous price, post-trial price, automatic
  renewal flag, or exact expiry timestamp for either SKU. The official
  [Lighthouse purchase page](https://buy.tencentcloud.com/lighthouse) and the
  [CVM pricing calculator](https://www.tencentcloud.com/pricing/cvm/calculator)
  require the exact region/configuration (and, for promotions, account state).
  Record the renewal order total and the expiration date before creating the
  server.
- Lighthouse supports manual renewal and configurable auto-renewal in its
  console; cloud data disks renew with the instance. See Tencent's
  [renewal instructions](https://www.tencentcloud.com/document/product/1103/41559).
  Do not turn on auto-renewal until the displayed non-promotional price is
  acceptable.
- For a directional, **non-equivalent** paid comparison only, Tencent's
  logged-in Lighthouse Special Offers page was observed on 2026-07-19 showing
  Singapore annual Starter bundles: 2C2G/20M/40G at USD 10.08 for one year
  (shown list USD 50.40), and 2C4G/30M/60G at USD 28.80 for one year (shown
  list USD 72). These are different one-year 20M/40G and 30M/60G SKUs, not the
  trial's 30M/30G SKU, so they cannot establish its post-trial renewal price.
  The promotion rules modal also displayed an end date of 2025-12-31; treat
  that stale-looking rule text as another reason to trust checkout over a
  marketing page.
- For a Lighthouse traffic-package instance, usage over the included monthly
  allowance is billed as outbound public-network data transfer, settled hourly.
  If the account becomes overdue after excess traffic, Tencent can suspend the
  instance; see [Billing Overview](https://www.tencentcloud.com/document/product/1103/41403)
  and [Overdue Payments](https://www.tencentcloud.com/document/product/1103/41405).

## Network, region, IP, and backup caveats

- Lighthouse package bandwidth is an **outbound** cap. A package below 10 Mbps
  receives 10 Mbps inbound public bandwidth; this 30 Mbps plan receives 30 Mbps
  inbound. The official [instance-package documentation](https://www.tencentcloud.com/document/product/1103/41264)
  also says purchasable packages vary by region and the actual purchase page
  prevails.
- Singapore is explicitly available for the currently displayed Lighthouse
  2C2G offer. For CVM, do not infer it from the trial name: select Singapore
  in the signed-in order flow and confirm the `S5.MEDIUM4` plus the intended
  public-network option. Tencent's [CVM pricing page](https://www.tencentcloud.com/pricing/cvm)
  is the official price entry point.
- Lighthouse includes a managed public IP for the instance workflow; it can be
  changed only once during that instance's lifetime, and the old address is
  released. Use a DNS name rather than depending on an IP address. Source:
  [Adjusting the Public IP Address](https://www.tencentcloud.com/document/product/1103/46401).
  CVM networking is more flexible but separately managed (VPC, subnet, public
  IP/EIP, and security group), as Tencent describes in its
  [Lighthouse-versus-CVM comparison](https://www.tencentcloud.com/document/product/1103/41521).
- Lighthouse snapshots are manual, system-disk point-in-time copies. Eligible
  active instances receive up to two free snapshots per created instance per
  region, capped at ten; snapshots are deleted when the instance is terminated.
  They are not a substitute for an off-host PostgreSQL backup. Source:
  [Data Backup and Restoration Using Snapshots](https://www.tencentcloud.com/document/product/1103/41394).
- Tencent notes that cross-border access to an overseas Lighthouse region from
  Mainland China can have latency and packet loss; select Singapore for Vietnam
  users only after a small real-user/network check. See
  [Region and Network Connectivity](https://www.tencentcloud.com/document/product/1103/41266).

## Decision gate before migration

Proceed only after the account-specific checkout confirms all of the following:

1. Singapore is selectable for the chosen offer and the exact image/disk/network
   values match the table above.
2. The checkout displays the **paid renewal total**, renewal behavior, and the
   exact expiry date; capture them with the order record.
3. Lighthouse has at least 1,024 GB/month traffic and 30 Mbps outbound, or the
   CVM alternative has more than 1 Mbps public bandwidth at an acceptable cost.
4. DNS cutover has a rollback window, PostgreSQL has a tested off-host restore,
   and no database port will be exposed publicly.

## Primary sources

- [Tencent Cloud Free Tier](https://www.tencentcloud.com/act/pro/FreeTier) —
  current promotion metadata and account-limited checkout choices.
- [Lighthouse product page](https://www.tencentcloud.com/products/lighthouse)
  and [documentation index](https://www.tencentcloud.com/document/product/1103).
- [Lighthouse instance packages](https://www.tencentcloud.com/document/product/1103/41264),
  [billing](https://www.tencentcloud.com/document/product/1103/41403), and
  [pricing details](https://www.tencentcloud.com/document/product/1103/47794).
- [CVM product page](https://www.tencentcloud.com/products/cvm) and
  [CVM calculator](https://www.tencentcloud.com/pricing/cvm/calculator).
