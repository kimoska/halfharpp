import "./env.js";
import fs from "node:fs/promises";
import path from "node:path";
import { secureEnvPath } from "./env.js";
import { loadAutomation, loadBrand, loadProducts, loadQueue, loadSeeds, saveQueue, appendLog, readJson, writeJsonAtomic, loadResearchConfig, loadResearchLeads, saveResearchLeads, loadResearchBriefs, saveResearchBriefs, loadResearchRuns, saveResearchRuns } from "./storage.js";
import { buildQueue } from "./scheduler.js";
import { composeText, validateDuplicates, validatePost, validateProduct, validateSpacing } from "./policy.js";
import { renderPost } from "./renderer.js";
import { enrichPost } from "./openai.js";
import { makePublic } from "./media.js";
import { ThreadsClient } from "./threads.js";
import { parseArg } from "./utils.js";
import { extractPosePack } from "./extract-poses.js";
import type { QueuePost, ValidationIssue } from "./types.js";
import type { ResearchLead } from "./research-types.js";
import { paths } from "./paths.js";
import { makeLead } from "./research/normalize.js";
import { collectConfiguredSources } from "./research/sources.js";
import { makeResearchRun, mergeAndRankLeads, validateBrief, validateLead } from "./research/pipeline.js";
import { generateEditorialBrief } from "./research/planner.js";
import { renderEditorialBrief } from "./research/card-renderer.js";
import { TossSharelinkClient } from "./toss/client.js";
import { syncTossProducts } from "./toss/sync.js";

function printIssues(issues: ValidationIssue[]): void {
  if (issues.length === 0) console.log("✓ 검증 통과");
  for (const issue of issues) console.log(`${issue.level === "error" ? "✗" : "!"} ${issue.code}${issue.postId ? ` [${issue.postId}]` : ""}: ${issue.message}`);
}

async function validate(): Promise<number> {
  const [brand, queue, products] = await Promise.all([loadBrand(), loadQueue(), loadProducts()]);
  const issues = [...products.flatMap((product) => validateProduct(product, brand)), ...queue.flatMap((post) => validatePost(post, brand)), ...validateSpacing(queue, brand), ...validateDuplicates(queue)];
  printIssues(issues);
  console.log(`상품 ${products.length}개, 게시물 ${queue.length}개 검사`);
  return issues.some((issue) => issue.level === "error") ? 1 : 0;
}

async function seed(args: string[]): Promise<void> {
  if (!args.includes("--legacy")) throw new Error("구형 단문 시드는 품질 미달로 잠갔습니다. 검증된 research-cycle을 사용하세요.");
  const days = Math.max(1, Math.min(90, Number(parseArg(args, "--days", "30")) || 30));
  const [brand, automation, seeds, products, current] = await Promise.all([loadBrand(), loadAutomation(), loadSeeds(), loadProducts(), loadQueue()]);
  const created = buildQueue(days, brand, automation, seeds, products);
  const ids = new Set(current.map((post) => post.id));
  const merged = [...current, ...created.filter((post) => !ids.has(post.id))].sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
  await saveQueue(merged);
  console.log(`✓ ${merged.length - current.length}개 게시물을 추가했습니다. 전체 ${merged.length}개`);
}

async function reseed(args: string[]): Promise<void> {
  if (!args.includes("--legacy")) throw new Error("구형 단문 시드는 품질 미달로 잠갔습니다. 검증된 research-cycle을 사용하세요.");
  const days = Math.max(1, Math.min(90, Number(parseArg(args, "--days", "30")) || 30));
  const [brand, automation, seeds, products, current] = await Promise.all([loadBrand(), loadAutomation(), loadSeeds(), loadProducts(), loadQueue()]);
  const preserved = current.filter((post) => post.status === "published");
  const planned = buildQueue(days, brand, automation, seeds, products);
  await saveQueue([...preserved, ...planned].sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt)));
  console.log(`✓ 게시 완료 ${preserved.length}개를 보존하고 미래 게시물 ${planned.length}개를 다시 계획했습니다.`);
}

async function syncProducts(): Promise<void> {
  const [brand, products, queue] = await Promise.all([loadBrand(), loadProducts(), loadQueue()]);
  const byId = new Map(products.map((product) => [product.id, product]));
  let count = 0;
  for (const post of queue) {
    if (post.pillar !== "affiliate" || post.status === "published" || !post.productId) continue;
    const product = byId.get(post.productId);
    if (!product?.active) continue;
    post.affiliateUrl = product.affiliateUrl;
    post.priceCheckedAt = product.priceCheckedAt;
    post.body = post.body.replace(/현재 표시 가격은 [\d,]+원/, `현재 표시 가격은 ${product.price.toLocaleString("ko-KR")}원`);
    post.text = composeText(post, brand);
    post.updatedAt = new Date().toISOString();
    count += 1;
  }
  await saveQueue(queue);
  console.log(`✓ 제휴 초안 ${count}개에 최신 상품 정보를 동기화했습니다.`);
}

async function tossDoctor(): Promise<number> {
  const configured = Boolean(process.env.TOSS_SHARELINK_ACCESS_KEY && process.env.TOSS_SHARELINK_SECRET_KEY && process.env.TOSS_SHARELINK_PUBLISHER_ID);
  if (!configured) {
    console.log("- 토스 쉐어링크 승인·Access Key·Secret Key·publisherId 대기 중");
    return 0;
  }
  const health = await new TossSharelinkClient().health();
  console.log(health.status === "ok" ? "✓ 토스 쉐어링크 인증·출발지 IP 연결 정상" : `✗ 토스 health 상태: ${health.status}`);
  return health.status === "ok" ? 0 : 1;
}

async function tossSync(): Promise<void> {
  if (!process.env.TOSS_SHARELINK_ACCESS_KEY || !process.env.TOSS_SHARELINK_SECRET_KEY || !process.env.TOSS_SHARELINK_PUBLISHER_ID) {
    console.log("- 토스 쉐어링크 승인 정보가 없어 상품 동기화를 건너뜁니다.");
    return;
  }
  const products = await syncTossProducts();
  console.log(`✓ 토스 베스트 상품·추적 링크 ${products.length}개 캐시 완료`);
}

async function aiEnrich(args: string[]): Promise<void> {
  const limit = Math.max(1, Number(parseArg(args, "--limit", "10")) || 10);
  const [brand, queue] = await Promise.all([loadBrand(), loadQueue()]);
  let count = 0;
  for (let index = 0; index < queue.length && count < limit; index += 1) {
    const post = queue[index]!;
    if (post.status === "published" || post.status === "skipped") continue;
    queue[index] = await enrichPost(post, brand);
    count += 1;
    console.log(`✓ AI 문안 ${count}/${limit}: ${post.id}`);
  }
  await saveQueue(queue);
}

async function render(args: string[]): Promise<void> {
  const all = args.includes("--all");
  const queue = await loadQueue();
  let count = 0;
  for (const post of queue) {
    if (!all && !["approved", "rendered"].includes(post.status)) continue;
    if (["published", "skipped"].includes(post.status)) continue;
    post.imagePath = path.relative(process.cwd(), await renderPost(post)).replaceAll("\\", "/");
    if (post.status === "approved") post.status = "rendered";
    post.updatedAt = new Date().toISOString();
    count += 1;
  }
  await saveQueue(queue);
  console.log(`✓ 카드 이미지 ${count}개 렌더링`);
}

async function approve(id: string | undefined): Promise<void> {
  if (!id) throw new Error("승인할 게시물 ID가 필요합니다.");
  const queue = await loadQueue();
  const post = queue.find((item) => item.id === id);
  if (!post) throw new Error(`게시물을 찾지 못했습니다: ${id}`);
  post.status = "approved";
  post.updatedAt = new Date().toISOString();
  await saveQueue(queue);
  console.log(`✓ 승인: ${id}`);
}

async function run(args: string[]): Promise<void> {
  const allDue = args.includes("--all-due");
  const [brand, automation, queue] = await Promise.all([loadBrand(), loadAutomation(), loadQueue()]);
  const dryRun = args.includes("--dry-run") || automation.dryRunByDefault || process.env.LIVE_PUBLISH_ENABLED !== "true";
  const now = new Date();
  const candidates = queue.filter((post) => ["approved", "rendered"].includes(post.status) && (allDue || Date.parse(post.scheduledAt) <= now.getTime()));
  const selected = automation.publishOnePerRun ? candidates.slice(0, 1) : candidates;
  if (selected.length === 0) {
    console.log("게시할 항목이 없습니다.");
    return;
  }
  const client = new ThreadsClient();
  for (const post of selected) {
    const issues = validatePost(post, brand, now).filter((issue) => issue.level === "error");
    if (issues.length) {
      printIssues(issues);
      continue;
    }
    try {
      if (post.imagePaths?.length) {
        const missing = (await Promise.all(post.imagePaths.map((item) => fs.stat(path.resolve(item)).catch(() => null)))).some((item) => !item);
        if (missing) throw new Error("카드뉴스 이미지 일부가 없습니다. research-render를 다시 실행하세요.");
      } else if (!post.imagePath || !(await fs.stat(path.resolve(post.imagePath)).catch(() => null))) {
        post.imagePath = path.relative(process.cwd(), await renderPost(post)).replaceAll("\\", "/");
        post.status = "rendered";
      }
      if (dryRun) {
        console.log(`\n--- DRY RUN ${post.id} ---\n${post.text}\n이미지: ${(post.imagePaths ?? [post.imagePath]).filter(Boolean).join(", ")}\n`);
        await appendLog({ event: "dry_run", postId: post.id, imagePaths: post.imagePaths ?? [post.imagePath] });
        continue;
      }
      if (post.imagePaths?.length) {
        post.publicImageUrls ||= await Promise.all(post.imagePaths.map((item) => makePublic(path.resolve(item))));
        post.publicImageUrl ||= post.publicImageUrls[0];
      } else {
        post.publicImageUrl ||= await makePublic(path.resolve(post.imagePath!));
      }
      const result = await client.publish(post, automation);
      post.status = "published";
      post.threadsPostId = result.id;
      post.permalink = result.permalink;
      post.lastError = undefined;
      await appendLog({ event: "published", postId: post.id, threadsPostId: result.id, permalink: result.permalink });
      console.log(`✓ 게시 완료: ${result.permalink || result.id}`);
    } catch (error) {
      post.attempts += 1;
      post.lastError = error instanceof Error ? error.message : String(error);
      if (post.attempts >= automation.maxAttempts) post.status = "failed";
      await appendLog({ event: "publish_failed", postId: post.id, attempts: post.attempts, error: post.lastError });
      console.error(`✗ ${post.id}: ${post.lastError}`);
    } finally {
      post.updatedAt = new Date().toISOString();
      await saveQueue(queue);
    }
  }
}

async function report(): Promise<void> {
  const queue = await loadQueue();
  const counts = queue.reduce<Partial<Record<QueuePost["status"], QueuePost[]>>>((groups, post) => {
    (groups[post.status] ??= []).push(post);
    return groups;
  }, {});
  console.log("하프하프 모하프 자동화 현황");
  for (const key of ["draft", "approved", "rendered", "published", "failed", "skipped"] as const) console.log(`- ${key}: ${counts[key]?.length ?? 0}`);
  const next = queue.find((post) => ["approved", "rendered"].includes(post.status));
  if (next) console.log(`다음 게시: ${next.scheduledAt} / ${next.id} / ${next.pillar}`);
}

async function researchDoctor(): Promise<number> {
  const config = await loadResearchConfig();
  const checks = [
    { ok: Boolean(process.env.NAVER_CLIENT_ID && process.env.NAVER_CLIENT_SECRET), message: "네이버 검색 API 키" },
    { ok: Boolean(process.env.YOUTUBE_API_KEY), message: "YouTube Data API 키" },
    { ok: Boolean(process.env.THREADS_ACCESS_TOKEN), message: "Threads 액세스 토큰" },
    { ok: Boolean(process.env.OPENAI_API_KEY), message: "OpenAI 기획 API 키" },
    { ok: config.queries.length >= 5, message: "검색어 5개 이상" },
    { ok: config.primaryDomains.length >= 5, message: "공식 근거 도메인 5개 이상" }
  ];
  for (const check of checks) console.log(`${check.ok ? "✓" : "✗"} ${check.message}`);
  console.log("키가 없는 출처는 전체 실행을 중단시키지 않고 건너뜁니다.");
  return checks.slice(4).every((check) => check.ok) ? 0 : 1;
}

async function researchCollect(): Promise<void> {
  const startedAt = new Date().toISOString();
  const [config, existing, runs] = await Promise.all([loadResearchConfig(), loadResearchLeads(), loadResearchRuns()]);
  const result = await collectConfiguredSources(config);
  const finishedAt = new Date().toISOString();
  const merged = mergeAndRankLeads(existing, result.leads, config, new Date(finishedAt));
  const run = makeResearchRun(startedAt, finishedAt, result.leads.length, merged.accepted, merged.duplicates, result.diagnostics);
  await Promise.all([saveResearchLeads(merged.leads), saveResearchRuns([...runs, run].slice(-100))]);
  for (const diagnostic of result.diagnostics) console.log(`${diagnostic.status === "ok" ? "✓" : diagnostic.status === "skipped" ? "-" : "✗"} ${diagnostic.source}: ${diagnostic.message} (${diagnostic.collected})`);
  console.log(`수집 ${run.collected}개 · 기준 통과 ${run.accepted}개 · 중복 ${run.duplicates}개 · 누적 ${merged.leads.length}개`);
}

async function researchImport(args: string[]): Promise<void> {
  const url = parseArg(args, "--url");
  const title = parseArg(args, "--title");
  if (!url || !title) throw new Error("--url과 --title이 필요합니다.");
  const tier = Number(parseArg(args, "--tier", "2")) === 1 ? 1 : 2;
  const [config, existing] = await Promise.all([loadResearchConfig(), loadResearchLeads()]);
  const lead = makeLead({
    source: tier === 1 ? "official" : "manual",
    query: parseArg(args, "--query", "수동 조사")!,
    title,
    excerpt: parseArg(args, "--excerpt", "")!,
    url,
    sourceTier: tier,
    maxExcerptChars: config.maxExcerptChars
  });
  const merged = mergeAndRankLeads(existing, [lead], config);
  const issues = validateLead(merged.leads.find((item) => item.id === lead.id) ?? lead, config).filter((issue) => issue.level === "error");
  if (issues.length) throw new Error(issues.map((issue) => `${issue.code}: ${issue.message}`).join("\n"));
  await saveResearchLeads(merged.leads);
  console.log(`✓ 자료 등록: ${title}`);
}

async function researchPlan(args: string[]): Promise<void> {
  const limit = Math.max(3, Math.min(12, Number(parseArg(args, "--leads", "10")) || 10));
  const [config, leads, briefs] = await Promise.all([loadResearchConfig(), loadResearchLeads(), loadResearchBriefs()]);
  const selected = leads.filter((lead) => !lead.duplicateOf && lead.score >= config.minLeadScore).slice(0, limit);
  if (selected.length < 3) throw new Error("기획에 사용할 기준 통과 소재가 3개 미만입니다. 먼저 research-collect 또는 research-import를 실행하세요.");
  const brief = await generateEditorialBrief(selected);
  const issues = validateBrief(brief, leads).filter((issue) => issue.level === "error");
  if (issues.length) throw new Error(`생성된 기획안 검증 실패:\n${issues.map((issue) => `${issue.code}: ${issue.message}`).join("\n")}`);
  await saveResearchBriefs([brief, ...briefs].slice(0, 200));
  console.log(`✓ 기획안 생성·검증 완료: ${brief.id} / ${brief.topic} / ${brief.slides.length}장`);
}

async function researchRender(args: string[]): Promise<void> {
  const [briefs, queue, leads] = await Promise.all([loadResearchBriefs(), loadQueue(), loadResearchLeads()]);
  const requestedId = args[0];
  const selected = requestedId ? briefs.filter((brief) => brief.id === requestedId) : briefs;
  if (selected.length === 0) throw new Error(requestedId ? `기획안을 찾지 못했습니다: ${requestedId}` : "렌더링할 기획안이 없습니다.");
  for (const brief of selected) {
    const issues = validateBrief(brief, leads).filter((issue) => issue.level === "error");
    if (issues.length) throw new Error(`${brief.id} 검증 실패: ${issues.map((issue) => issue.code).join(", ")}`);
    const outputs = await renderEditorialBrief(brief);
    const post = queue.find((item) => item.briefId === brief.id);
    if (post) {
      post.imagePaths = outputs.map((output) => path.relative(process.cwd(), output).replaceAll("\\", "/"));
      post.imagePath = post.imagePaths[0];
      post.updatedAt = new Date().toISOString();
    }
    console.log(`✓ 카드뉴스 렌더링: ${brief.id} / ${outputs.length}장`);
  }
  await saveQueue(queue);
}

async function researchQueue(args: string[]): Promise<void> {
  const id = args[0];
  if (!id) throw new Error("대기열에 넣을 기획안 ID가 필요합니다.");
  const [briefs, queue, brand, leads] = await Promise.all([loadResearchBriefs(), loadQueue(), loadBrand(), loadResearchLeads()]);
  const brief = briefs.find((item) => item.id === id);
  if (!brief) throw new Error(`기획안을 찾지 못했습니다: ${id}`);
  const issues = validateBrief(brief, leads).filter((issue) => issue.level === "error");
  if (issues.length) throw new Error(`기획안 검증 실패: ${issues.map((issue) => issue.code).join(", ")}`);
  if (queue.some((item) => item.briefId === id)) throw new Error("이미 게시 대기열에 들어간 기획안입니다.");
  const tomorrow = new Date(Date.now() + 86_400_000);
  const date = new Date(tomorrow.getTime() + 9 * 3_600_000).toISOString().slice(0, 10);
  const scheduledAt = parseArg(args, "--at", `${date}T${brand.postingTimes[0]}:00+09:00`)!;
  if (!Number.isFinite(Date.parse(scheduledAt))) throw new Error("--at 예약 시각이 올바르지 않습니다.");
  const now = new Date().toISOString();
  const post: QueuePost = {
    id: `brief-${brief.id}`,
    briefId: brief.id,
    pillar: brief.pillar,
    scheduledAt,
    status: "draft",
    hook: brief.slides[0]?.headline ?? brief.topic,
    body: brief.caption,
    cta: brief.cta,
    text: [brief.caption, "", brief.cta, "", brand.hashtags.map((tag) => `#${tag}`).join(" ")].join("\n").trim(),
    template: "editorial-carousel-v1",
    requiresApproval: true,
    attempts: 0,
    createdAt: now,
    updatedAt: now
  };
  const outputs = await renderEditorialBrief(brief);
  post.imagePaths = outputs.map((output) => path.relative(process.cwd(), output).replaceAll("\\", "/"));
  post.imagePath = post.imagePaths[0];
  await saveQueue([...queue, post].sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt)));
  console.log(`✓ 검토 대기열 등록: ${post.id} / ${outputs.length}장 / 상태 draft`);
}

async function researchCycle(): Promise<void> {
  await researchCollect();
  const [config, leads, briefs] = await Promise.all([loadResearchConfig(), loadResearchLeads(), loadResearchBriefs()]);
  const validationErrors = [
    ...leads.flatMap((lead) => validateLead(lead, config)),
    ...briefs.flatMap((brief) => validateBrief(brief, leads))
  ].filter((issue) => issue.level === "error");
  if (validationErrors.length) throw new Error(`자료조사 검증 오류 ${validationErrors.length}개: ${validationErrors.slice(0, 5).map((issue) => issue.code).join(", ")}`);
  if (!process.env.OPENAI_API_KEY) {
    console.log("- OPENAI_API_KEY가 없어 자동 기획만 건너뜁니다. 수집·검증 결과는 저장했습니다.");
    return;
  }
  const latest = briefs.map((brief) => Date.parse(brief.createdAt)).filter(Number.isFinite).sort((a, b) => b - a)[0];
  if (latest && Date.now() - latest < 18 * 3_600_000) {
    console.log("- 최근 18시간 안에 생성된 기획안이 있어 중복 생성을 건너뜁니다.");
    return;
  }
  const selected = leads.filter((lead) => !lead.duplicateOf && lead.score >= config.minLeadScore).slice(0, 10);
  if (selected.length < 3) {
    console.log("- 기준 통과 소재가 3개 미만이라 자동 기획을 보류합니다.");
    return;
  }
  const brief = await generateEditorialBrief(selected);
  const issues = validateBrief(brief, leads).filter((issue) => issue.level === "error");
  if (issues.length) throw new Error(`자동 기획 검증 실패: ${issues.map((issue) => issue.code).join(", ")}`);
  await saveResearchBriefs([brief, ...briefs].slice(0, 200));
  await researchQueue([brief.id]);
  console.log(`✓ 일일 자료조사→기획→렌더링→검토 대기열 완료: ${brief.id}`);
}

async function researchValidate(): Promise<number> {
  const [config, leads, briefs] = await Promise.all([loadResearchConfig(), loadResearchLeads(), loadResearchBriefs()]);
  const issues = [...leads.flatMap((lead) => validateLead(lead, config)), ...briefs.flatMap((brief) => validateBrief(brief, leads))];
  for (const issue of issues) console.log(`${issue.level === "error" ? "✗" : "!"} ${issue.code}${issue.id ? ` [${issue.id}]` : ""}: ${issue.message}`);
  if (issues.length === 0) console.log("✓ 자료와 기획안 검증 통과");
  console.log(`자료 ${leads.length}개 · 기획안 ${briefs.length}개 · 오류 ${issues.filter((issue) => issue.level === "error").length}개`);
  return issues.some((issue) => issue.level === "error") ? 1 : 0;
}

async function researchReport(): Promise<void> {
  const [config, leads, briefs, runs] = await Promise.all([loadResearchConfig(), loadResearchLeads(), loadResearchBriefs(), loadResearchRuns()]);
  console.log("모하프 자료조사 현황");
  console.log(`- 누적 소재: ${leads.length}`);
  console.log(`- 기준 통과: ${leads.filter((lead) => lead.score >= config.minLeadScore).length}`);
  console.log(`- 공식·보도 근거: ${leads.filter((lead) => lead.sourceTier <= 2).length}`);
  console.log(`- 기획안: ${briefs.length}`);
  console.log(`- 수집 실행: ${runs.length}`);
  for (const lead of leads.slice(0, 5)) console.log(`  ${lead.score}점 [${lead.source}] ${lead.title}`);
}

async function doctor(): Promise<number> {
  const [brand, automation, products, queue] = await Promise.all([loadBrand(), loadAutomation(), loadProducts(), loadQueue()]);
  const checks = [
    { ok: Boolean(process.env.THREADS_ACCESS_TOKEN), message: "Threads 액세스 토큰" },
    { ok: process.env.LIVE_PUBLISH_ENABLED === "true", message: "LIVE_PUBLISH_ENABLED=true" },
    { ok: automation.dryRunByDefault === false, message: "dryRunByDefault=false" },
    { ok: Boolean(process.env.PUBLIC_MEDIA_BASE_URL || (process.env.GITHUB_MEDIA_REPO && process.env.GITHUB_MEDIA_TOKEN)), message: "공개 이미지 저장소" },
    { ok: products.some((product) => product.active), message: "활성 토스 제휴상품" },
    { ok: !products.some((product) => product.active) || queue.some((post) => post.pillar === "affiliate"), message: "제휴상품이 반영된 게시 계획" },
    { ok: ![...queue.flatMap((post) => validatePost(post, brand)), ...validateSpacing(queue, brand), ...validateDuplicates(queue)].some((issue) => issue.level === "error"), message: "게시 큐 정책 검사" }
  ];
  for (const check of checks) console.log(`${check.ok ? "✓" : "✗"} ${check.message}`);
  return checks.every((check) => check.ok) ? 0 : 1;
}

async function insights(): Promise<void> {
  if (!process.env.THREADS_ACCESS_TOKEN) {
    console.log("THREADS_ACCESS_TOKEN이 없어 성과 수집을 건너뜁니다.");
    return;
  }
  const queue = await loadQueue();
  const published = queue.filter((post) => post.status === "published" && post.threadsPostId);
  if (published.length === 0) {
    console.log("성과를 수집할 게시물이 없습니다.");
    return;
  }
  const snapshots: Array<Record<string, unknown>> = await readJson<Array<Record<string, unknown>>>(paths.metrics).catch(() => [] as Array<Record<string, unknown>>);
  const client = new ThreadsClient();
  for (const post of published) {
    const result = await client.getPostInsights(post.threadsPostId!);
    const metrics = Object.fromEntries(result.data.map((item) => [item.name, item.values?.at(-1)?.value ?? item.total_value?.value ?? 0]));
    snapshots.push({ capturedAt: new Date().toISOString(), postId: post.id, threadsPostId: post.threadsPostId, pillar: post.pillar, metrics });
    console.log(`✓ 성과 수집: ${post.id}`);
  }
  await writeJsonAtomic(paths.metrics, snapshots);
}

async function initSecrets(): Promise<void> {
  await fs.mkdir(path.dirname(secureEnvPath), { recursive: true });
  const template = `# OneDrive 밖에 보관되는 모하프 자동화 비밀 설정\nTHREADS_ACCESS_TOKEN=\nTHREADS_USER_ID=me\n\nGITHUB_MEDIA_TOKEN=\nGITHUB_MEDIA_REPO=\nGITHUB_MEDIA_BRANCH=main\nGITHUB_MEDIA_PREFIX=moharp/generated\n\nNAVER_CLIENT_ID=\nNAVER_CLIENT_SECRET=\nYOUTUBE_API_KEY=\nTHREADS_SEARCH_URL=https://graph.threads.net/keyword_search\n\nTOSS_SHARELINK_ACCESS_KEY=\nTOSS_SHARELINK_SECRET_KEY=\nTOSS_SHARELINK_PUBLISHER_ID=\nTOSS_SHARELINK_SUBTAG_ID=threads_halfharpp\n\nOPENAI_API_KEY=\nOPENAI_MODEL_QUALITY=gpt-6-astra\nOPENAI_MODEL_FAST=gpt-5.6-luna\nLIVE_PUBLISH_ENABLED=false\n`;
  try {
    await fs.writeFile(secureEnvPath, template, { encoding: "utf8", flag: "wx" });
    console.log(`✓ 로컬 비밀 설정 파일을 만들었습니다: ${secureEnvPath}`);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== "EEXIST") throw error;
    const current = await fs.readFile(secureEnvPath, "utf8");
    const missing = template.split(/\r?\n/).filter((line) => /^[A-Z0-9_]+=/.test(line) && !current.split(/\r?\n/).some((saved) => saved.startsWith(`${line.split("=")[0]}=`)));
    if (missing.length) await fs.appendFile(secureEnvPath, `\n# 자료조사·쉐어링크 추가 설정\n${missing.join("\n")}\n`, "utf8");
    console.log(`✓ 로컬 비밀 설정 파일 확인 완료${missing.length ? ` · 누락 항목 ${missing.length}개 추가` : ""}: ${secureEnvPath}`);
  }
}

function help(): void {
  console.log(`모하프 Threads 자동화\n\n명령:\n  init-secrets\n  research-doctor\n  research-collect\n  research-cycle\n  research-import --url <주소> --title <제목> [--excerpt <요약>] [--tier 1|2]\n  research-plan [--leads 10]\n  research-render [기획안ID]\n  research-queue <기획안ID> [--at ISO시각]\n  research-validate\n  research-report\n  toss-doctor\n  toss-sync\n  validate\n  doctor\n  seed --days 30 --legacy\n  reseed --days 30 --legacy\n  sync-products\n  ai-enrich --limit 10\n  render [--all]\n  extract-poses\n  approve <게시물ID>\n  run [--dry-run] [--all-due]\n  insights\n  report`);
}

async function main(): Promise<void> {
  const [command = "help", ...args] = process.argv.slice(2);
  let code = 0;
  switch (command) {
    case "init-secrets": await initSecrets(); break;
    case "research-doctor": code = await researchDoctor(); break;
    case "research-collect": await researchCollect(); break;
    case "research-cycle": await researchCycle(); break;
    case "research-import": await researchImport(args); break;
    case "research-plan": await researchPlan(args); break;
    case "research-render": await researchRender(args); break;
    case "research-queue": await researchQueue(args); break;
    case "research-validate": code = await researchValidate(); break;
    case "research-report": await researchReport(); break;
    case "toss-doctor": code = await tossDoctor(); break;
    case "toss-sync": await tossSync(); break;
    case "validate": code = await validate(); break;
    case "doctor": code = await doctor(); break;
    case "seed": await seed(args); break;
    case "reseed": await reseed(args); break;
    case "sync-products": await syncProducts(); break;
    case "ai-enrich": await aiEnrich(args); break;
    case "render": await render(args); break;
    case "extract-poses": await extractPosePack(); break;
    case "approve": await approve(args[0]); break;
    case "run": await run(args); break;
    case "insights": await insights(); break;
    case "report": await report(); break;
    default: help();
  }
  process.exitCode = code;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
