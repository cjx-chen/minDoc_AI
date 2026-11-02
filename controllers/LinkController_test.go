package controllers

import (
	"net"
	"net/url"
	"strings"
	"testing"

	"github.com/PuerkitoBio/goquery"
)

func mustDoc(t *testing.T, html string) *goquery.Document {
	t.Helper()
	doc, err := goquery.NewDocumentFromReader(strings.NewReader(html))
	if err != nil {
		t.Fatalf("parse html failed: %v", err)
	}
	return doc
}

func TestParsePageMetadataPriority(t *testing.T) {
	html := `<!DOCTYPE html>
<html>
<head>
	<title>普通标题</title>
	<meta name="description" content="普通描述">
	<meta property="og:title" content="OpenGraph 标题">
	<meta property="og:description" content="OpenGraph 描述">
	<meta property="og:site_name" content="示例站点">
	<meta property="og:image" content="/static/cover.png">
	<link rel="icon" href="favicon.ico">
</head>
<body><h1>hello</h1></body>
</html>`
	finalURL, _ := url.Parse("https://example.com/docs/page.html")
	result := &linkPreviewResult{Url: finalURL.String()}

	parsePageMetadata(mustDoc(t, html), finalURL, result)

	if result.Title != "OpenGraph 标题" {
		t.Errorf("title = %q, want og:title 优先", result.Title)
	}
	if result.Description != "OpenGraph 描述" {
		t.Errorf("description = %q, want og:description 优先", result.Description)
	}
	if result.SiteName != "示例站点" {
		t.Errorf("site_name = %q", result.SiteName)
	}
	if result.ImageUrl != "https://example.com/static/cover.png" {
		t.Errorf("image_url = %q, 相对地址应补全为绝对地址", result.ImageUrl)
	}
	if result.IconUrl != "https://example.com/docs/favicon.ico" {
		t.Errorf("icon_url = %q, 相对地址应基于页面路径补全", result.IconUrl)
	}
}

func TestParsePageMetadataFallback(t *testing.T) {
	html := `<html><head><title>回退标题</title>
	<meta name="twitter:description" content="推特描述">
	<link rel="apple-touch-icon" href="//cdn.example.com/icon.png">
	</head><body></body></html>`
	finalURL, _ := url.Parse("https://example.com/")
	result := &linkPreviewResult{}

	parsePageMetadata(mustDoc(t, html), finalURL, result)

	if result.Title != "回退标题" {
		t.Errorf("title = %q, 无 og:title 时应回退 <title>", result.Title)
	}
	if result.Description != "推特描述" {
		t.Errorf("description = %q, 应回退 twitter:description", result.Description)
	}
	if result.SiteName != "example.com" {
		t.Errorf("site_name = %q, 应回退主机名", result.SiteName)
	}
	if result.IconUrl != "https://cdn.example.com/icon.png" {
		t.Errorf("icon_url = %q, // 开头应补全协议", result.IconUrl)
	}
	if result.ImageUrl != "" {
		t.Errorf("image_url = %q, 无 og:image 时应为空", result.ImageUrl)
	}
}

func TestParsePageMetadataMinimal(t *testing.T) {
	html := `<html><head></head><body>空页面</body></html>`
	finalURL, _ := url.Parse("https://mindoc.example/")
	result := &linkPreviewResult{}

	parsePageMetadata(mustDoc(t, html), finalURL, result)

	if result.Title != "mindoc.example" {
		t.Errorf("title = %q, 无任何标题时应回退主机名", result.Title)
	}
	if result.IconUrl != "https://mindoc.example/favicon.ico" {
		t.Errorf("icon_url = %q, 应回退约定 favicon 路径", result.IconUrl)
	}
}

func TestIsBlockedIP(t *testing.T) {
	blocked := []string{
		"127.0.0.1", "127.8.9.1", "10.1.2.3", "192.168.1.1", "172.16.5.4",
		"169.254.1.1", "100.64.0.1", "0.0.0.0", "224.0.0.1", "255.255.255.255",
		"192.0.2.1", "203.0.113.9",
		"::1", "::", "fe80::1", "fc00::1", "ff02::1", "2001:db8::1",
	}
	for _, ip := range blocked {
		if !isBlockedIP(parseIP(t, ip)) {
			t.Errorf("isBlockedIP(%s) = false, want true", ip)
		}
	}
	allowed := []string{"8.8.8.8", "1.1.1.1", "93.184.216.34", "2606:2800:220:1:248:1893:25c8:1946"}
	for _, ip := range allowed {
		if isBlockedIP(parseIP(t, ip)) {
			t.Errorf("isBlockedIP(%s) = true, want false", ip)
		}
	}
}

func TestIsFakeIPAllowed(t *testing.T) {
	// 本地代理（Clash/Surge fake-ip）段应放行：公网域名在本机解析到该段
	fakeIPs := []string{"198.18.0.138", "198.18.0.27", "198.19.255.255", "198.18.255.254"}
	for _, ip := range fakeIPs {
		if !isFakeIP(parseIP(t, ip)) {
			t.Errorf("isFakeIP(%s) = false, want true", ip)
		}
		if isBlockedIP(parseIP(t, ip)) {
			t.Errorf("isBlockedIP(%s) = true, fake-ip 段应放行", ip)
		}
	}
	// 邻近的真实保留段仍应拦截
	for _, ip := range []string{"198.16.0.1", "198.20.0.1", "198.51.100.9"} {
		if isFakeIP(parseIP(t, ip)) {
			t.Errorf("isFakeIP(%s) = true, want false", ip)
		}
	}
}

func TestValidateExternalURL(t *testing.T) {
	invalid := []string{
		"ftp://example.com/file",
		"file:///etc/passwd",
		"gopher://example.com/",
		"http://user:pass@example.com/",
		"http://localhost/",
		"http://localhost:8080/admin",
		"http://foo.local/",
		"http://db.internal/",
		"http://metadata.google.internal/computeMetadata/v1/",
		"not a url with spaces",
	}
	for _, raw := range invalid {
		if _, err := validateExternalURL(raw); err == nil {
			t.Errorf("validateExternalURL(%q) 应被拒绝", raw)
		}
	}
}

func TestResolveURL(t *testing.T) {
	base, _ := url.Parse("https://example.com/docs/page.html")
	cases := []struct {
		ref  string
		want string
	}{
		{"/static/a.png", "https://example.com/static/a.png"},
		{"a.png", "https://example.com/docs/a.png"},
		{"../up.png", "https://example.com/up.png"},
		{"https://other.com/x.png", "https://other.com/x.png"},
		{"http://other.com/x.png", "http://other.com/x.png"},
		{"//cdn.example.com/i.png", "https://cdn.example.com/i.png"},
		{"", ""},
	}
	for _, c := range cases {
		if got := resolveURL(base, c.ref); got != c.want {
			t.Errorf("resolveURL(%q) = %q, want %q", c.ref, got, c.want)
		}
	}
}

func TestFirstNonEmpty(t *testing.T) {
	if got := firstNonEmpty("", "  ", " b ", ""); got != "b" {
		t.Errorf("firstNonEmpty = %q, want b", got)
	}
	if got := firstNonEmpty("", "   "); got != "" {
		t.Errorf("firstNonEmpty = %q, want empty", got)
	}
}

func parseIP(t *testing.T, ip string) net.IP {
	t.Helper()
	parsed := net.ParseIP(ip)
	if parsed == nil {
		t.Fatalf("ParseIP(%s) failed", ip)
	}
	return parsed
}

func TestExtractPageContent(t *testing.T) {
	html := `<!DOCTYPE html>
<html>
<head><title>测试文章</title></head>
<body>
<nav>导航栏不该出现在正文里</nav>
<article>
<h1>支付系统设计</h1>
<p>支付系统是电商平台的核心模块，负责处理订单的收付款行为。一个可靠的支付系统需要保证交易的原子性、一致性和持久性。</p>
<p>联机交易报文由报文头与报文体组成。报文头包含交易码、渠道号、日期时间等控制信息；报文体承载具体的业务数据。</p>
<p>对账是支付系统的重要兜底手段，通过逐笔比对平台与渠道的交易流水，及时发现并处理差异。</p>
</article>
<footer>页脚版权信息</footer>
</body>
</html>`
	pageURL, _ := url.Parse("https://example.com/article")
	content := extractPageContent(strings.NewReader(html), pageURL)

	if content == "" {
		t.Fatal("extractPageContent 返回空，应提取到正文")
	}
	for _, keyword := range []string{"支付系统", "联机交易报文", "对账"} {
		if !strings.Contains(content, keyword) {
			t.Errorf("正文缺少关键内容 %q，实际提取：%s", keyword, content)
		}
	}
	if strings.Contains(content, "导航栏不该出现") || strings.Contains(content, "页脚版权信息") {
		t.Errorf("正文不应包含导航/页脚等非正文内容：%s", content)
	}
}

func TestExtractPageContentFallback(t *testing.T) {
	// 极小页面：兜底返回少量文本，且脚本/样式内容不得进入正文
	html := `<html><head><title>空</title><style>.a{color:red}</style><script>var secret = "SCRIPT_NOISE";</script></head>
<body><div>x</div><script>var tail = "TAIL_NOISE";</script></body></html>`
	pageURL, _ := url.Parse("https://example.com/")
	content := extractPageContent(strings.NewReader(html), pageURL)
	if strings.Contains(content, "SCRIPT_NOISE") || strings.Contains(content, "TAIL_NOISE") || strings.Contains(content, "color:red") {
		t.Errorf("正文不应包含脚本/样式内容：%q", content)
	}
	if len([]rune(content)) > 200 {
		t.Errorf("极小页面兜底文本应很短，实际 %d 字：%q", len([]rune(content)), content)
	}
}

func TestTruncateRunes(t *testing.T) {
	if got := truncateRunes("你好世界", 3); got != "你好世" {
		t.Errorf("truncateRunes = %q, want 你好世", got)
	}
	if got := truncateRunes("abc", 10); got != "abc" {
		t.Errorf("truncateRunes = %q, want abc", got)
	}
	if got := truncateRunes("中文测试", 0); got != "中文测试" {
		t.Errorf("truncateRunes max<=0 应原样返回，got %q", got)
	}
}

func TestNormalizeWebLinkURL(t *testing.T) {
	cases := []struct{ in, want string }{
		// 去跟踪参数
		{"https://example.com/a?utm_source=wx&utm_medium=social&id=42", "https://example.com/a?id=42"},
		{"https://example.com/a?gclid=abc123", "https://example.com/a"},
		{"https://example.com/a?spm=123&fbclid=xyz", "https://example.com/a"},
		// 保留 fragment（SPA 跳转需要）
		{"http://127.0.0.1:5199/#/runs", "http://127.0.0.1:5199/#/runs"},
		{"https://example.com/a?utm_source=x#/page", "https://example.com/a#/page"},
		// 小写主机名 + 去默认端口
		{"https://EXAMPLE.com:443/A", "https://example.com/A"},
		{"http://Example.com:80/a", "http://example.com/a"},
		// 普通 URL 不变
		{"https://example.com/a?b=c", "https://example.com/a?b=c"},
		{"", ""},
	}
	for _, c := range cases {
		if got := normalizeWebLinkURL(c.in); got != c.want {
			t.Errorf("normalizeWebLinkURL(%q) = %q, want %q", c.in, got, c.want)
		}
	}
}

func TestParseWebLinkDate(t *testing.T) {
	valid := []string{
		"2024-01-15T08:30:00+08:00",
		"2024-01-15T08:30:00Z",
		"2024-01-15 08:30:00",
		"2024-01-15",
		"2024/01/15",
		"2024年1月15日",
	}
	for _, v := range valid {
		if parseWebLinkDate(v) == nil {
			t.Errorf("parseWebLinkDate(%q) = nil, want 有效时间", v)
		}
	}
	for _, v := range []string{"", "  ", "not-a-date", "昨天"} {
		if parseWebLinkDate(v) != nil {
			t.Errorf("parseWebLinkDate(%q) 应为 nil", v)
		}
	}
}

func TestExtractJSONLD(t *testing.T) {
	html := `<html><head>
	<script type="application/ld+json">
	{"@context":"https://schema.org","@type":"Article","headline":"JSON-LD 标题",
	 "description":"JSON-LD 描述","datePublished":"2024-03-01T10:00:00+08:00",
	 "author":{"@type":"Person","name":"张三"},
	 "image":{"@type":"ImageObject","url":"https://cdn.example.com/ld.jpg"}}
	</script>
	<script type="application/ld+json">
	[{"@type":"WebSite","name":"站点名"},{"@type":"Article","headline":"数组里的标题"}]
	</script>
	</head><body></body></html>`
	jsonld := extractJSONLD(mustDoc(t, html))
	if got := jsonldString(jsonld, "headline"); got != "JSON-LD 标题" {
		t.Errorf("headline = %q", got)
	}
	if got := jsonldString(jsonld, "description"); got != "JSON-LD 描述" {
		t.Errorf("description = %q", got)
	}
	if got := jsonldString(jsonld, "author", "name"); got != "张三" {
		t.Errorf("author.name = %q", got)
	}
	if got := jsonldString(jsonld, "image", "url"); got != "https://cdn.example.com/ld.jpg" {
		t.Errorf("image.url = %q", got)
	}
	if got := jsonldString(jsonld, "datePublished"); got != "2024-03-01T10:00:00+08:00" {
		t.Errorf("datePublished = %q", got)
	}
	// 无效 JSON 不应 panic，返回空
	if m := extractJSONLD(mustDoc(t, `<script type="application/ld+json">{bad json</script>`)); len(m) != 0 {
		t.Errorf("无效 JSON-LD 应返回空 map, got %v", m)
	}
}

func TestParsePageMetadataJSONLDAndFallbacks(t *testing.T) {
	html := `<!DOCTYPE html><html><head>
	<title>普通标题</title>
	<meta property="article:published_time" content="2024-05-20T09:00:00+08:00">
	<meta name="author" content="李四">
	<script type="application/ld+json">
	{"@type":"Article","headline":"JSON-LD 优先标题","description":"JSON-LD 优先描述",
	 "datePublished":"2024-05-20T09:00:00+08:00","author":{"name":"王五"},
	 "image":{"url":"/ld-cover.png"}}
	</script>
	<link rel="icon" type="image/png" sizes="32x32" href="/small.png">
	<link rel="apple-touch-icon" sizes="180x180" href="/apple.png">
	</head><body>
	<article><h1>正文标题</h1><p>正文内容。</p><img src="/article-cover.png"></article>
	</body></html>`
	finalURL, _ := url.Parse("https://example.com/post/1")
	result := &linkPreviewResult{}
	parsePageMetadata(mustDoc(t, html), finalURL, result)

	if result.Title != "普通标题" {
		t.Errorf("title = %q, og 缺失时按 metascraper 链应取 <title>", result.Title)
	}
	if result.Description != "JSON-LD 优先描述" {
		t.Errorf("description = %q", result.Description)
	}
	if result.Author != "王五" {
		t.Errorf("author = %q, JSON-LD 优先", result.Author)
	}
	if result.PublishedAt != "2024-05-20T09:00:00+08:00" {
		t.Errorf("published_at = %q", result.PublishedAt)
	}
	if result.ImageUrl != "https://example.com/ld-cover.png" {
		t.Errorf("image = %q, JSON-LD image 应优先于正文首图", result.ImageUrl)
	}
	// apple-touch-icon 180x180 应优于 32x32 png
	if result.IconUrl != "https://example.com/apple.png" {
		t.Errorf("icon = %q, 应选 180x180 apple 图标", result.IconUrl)
	}
}

func TestParsePageMetadataJSONLDHeadlineFallback(t *testing.T) {
	// 无 og:title 也无 <title>：JSON-LD headline 兜底
	html := `<html><head>
	<script type="application/ld+json">{"@type":"Article","headline":"只有JSON-LD有标题"}</script>
	</head><body><h1>正文</h1></body></html>`
	finalURL, _ := url.Parse("https://example.com/x")
	result := &linkPreviewResult{}
	parsePageMetadata(mustDoc(t, html), finalURL, result)
	if result.Title != "只有JSON-LD有标题" {
		t.Errorf("title = %q, 无 og/title 时应取 JSON-LD headline", result.Title)
	}
}

func TestParsePageMetadataContentImageFallback(t *testing.T) {
	// 无 og:image 无 JSON-LD：应回退到正文首图
	html := `<html><head><title>无图文章</title></head><body>
	<article><p>正文。</p><img src="/first-content.png"></article>
	</body></html>`
	finalURL, _ := url.Parse("https://example.com/p")
	result := &linkPreviewResult{}
	parsePageMetadata(mustDoc(t, html), finalURL, result)
	if result.ImageUrl != "https://example.com/first-content.png" {
		t.Errorf("image = %q, 应回退正文首图", result.ImageUrl)
	}
}

func TestFallbackPageContent(t *testing.T) {
	html := `<html><body><script>var noise=1</script><style>.a{}</style>
	<p>第一段可见文本。</p><p>第二段可见文本。</p></body></html>`
	content := fallbackPageContent(mustDoc(t, html), "")
	if !strings.Contains(content, "第一段可见文本") || !strings.Contains(content, "第二段可见文本") {
		t.Errorf("兜底正文应包含可见文本: %q", content)
	}
	if strings.Contains(content, "noise") {
		t.Errorf("兜底正文不应包含脚本内容: %q", content)
	}
	// 有描述时优先用描述
	if got := fallbackPageContent(mustDoc(t, html), "这是描述"); got != "这是描述" {
		t.Errorf("有描述时应返回描述, got %q", got)
	}
}

func TestPublisherFromTitle(t *testing.T) {
	cases := []struct{ in, want string }{
		{"文章标题 - 知乎", "知乎"},
		{"联机交易报文规范 | 支付学院", "支付学院"},
		{"标题 — 站点名", "站点名"},
		{"标题 ｜ 全角竖线站", "全角竖线站"},
		{"A - B - C", "C"},
		{"没有分隔符的标题", ""},
		{"2024-01-15 日记", ""},
		{"", ""},
	}
	for _, c := range cases {
		if got := publisherFromTitle(c.in); got != c.want {
			t.Errorf("publisherFromTitle(%q) = %q, want %q", c.in, got, c.want)
		}
	}
}

func TestNormalizeLang(t *testing.T) {
	cases := []struct{ in, want string }{
		{"zh_CN", "zh-CN"},
		{"zh-CN", "zh-CN"},
		{"en-US;q=0.8", "en-US"},
		{"zh", "zh"},
		{"", ""},
	}
	for _, c := range cases {
		if got := normalizeLang(c.in); got != c.want {
			t.Errorf("normalizeLang(%q) = %q, want %q", c.in, got, c.want)
		}
	}
}

func TestResolveCanonicalURL(t *testing.T) {
	// 同主机 canonical 应接受
	html := `<html><head>
	<link rel="canonical" href="https://example.com/canonical/path">
	</head><body></body></html>`
	finalURL, _ := url.Parse("https://example.com/ messy?utm_source=x")
	if got := resolveCanonicalURL(mustDoc(t, html), finalURL); got != "https://example.com/canonical/path" {
		t.Errorf("同主机 canonical 应被接受, got %q", got)
	}

	// 跨主机 canonical 应拒绝（防劫持）
	html = `<html><head><link rel="canonical" href="https://evil.com/steal"></head><body></body></html>`
	finalURL, _ = url.Parse("https://example.com/p")
	if got := resolveCanonicalURL(mustDoc(t, html), finalURL); got != "" {
		t.Errorf("跨主机 canonical 应被拒绝, got %q", got)
	}

	// og:url 优先于 canonical
	html = `<html><head>
	<meta property="og:url" content="https://example.com/og-url">
	<link rel="canonical" href="https://example.com/canonical">
	</head><body></body></html>`
	finalURL, _ = url.Parse("https://example.com/p")
	if got := resolveCanonicalURL(mustDoc(t, html), finalURL); got != "https://example.com/og-url" {
		t.Errorf("og:url 应优先, got %q", got)
	}

	// 无 canonical 返回空
	if got := resolveCanonicalURL(mustDoc(t, `<html><head></head><body></body></html>`), finalURL); got != "" {
		t.Errorf("无 canonical 应返回空, got %q", got)
	}
}

func TestPickBestLogo(t *testing.T) {
	// og:logo 优先
	html := `<html><head><meta property="og:logo" content="/og-logo.png">
	<meta itemprop="logo" content="/itemprop-logo.png"></head><body></body></html>`
	finalURL, _ := url.Parse("https://example.com/p")
	if got := pickBestLogo(mustDoc(t, html), finalURL, nil); got != "https://example.com/og-logo.png" {
		t.Errorf("og:logo 应优先, got %q", got)
	}

	// 无 og:logo 时用 itemprop
	html = `<html><head><meta itemprop="logo" content="/itemprop-logo.png"></head><body></body></html>`
	if got := pickBestLogo(mustDoc(t, html), finalURL, nil); got != "https://example.com/itemprop-logo.png" {
		t.Errorf("itemprop logo 兜底, got %q", got)
	}

	// JSON-LD organization.logo.url 兜底
	jsonld := map[string]interface{}{
		"organization": map[string]interface{}{
			"logo": map[string]interface{}{"url": "https://cdn.example.com/org.png"},
		},
	}
	if got := pickBestLogo(mustDoc(t, `<html><head></head><body></body></html>`), finalURL, jsonld); got != "https://cdn.example.com/org.png" {
		t.Errorf("JSON-LD organization.logo.url 兜底, got %q", got)
	}

	// 都没有返回空
	if got := pickBestLogo(mustDoc(t, `<html><head></head><body></body></html>`), finalURL, nil); got != "" {
		t.Errorf("无 logo 应返回空, got %q", got)
	}
}

func TestParsePageMetadataPublisherAndLang(t *testing.T) {
	// 无 og:site_name：站点名从标题后缀提取，语言从 html lang
	html := `<html lang="zh_CN"><head><title>深入理解支付系统 - 支付学院</title></head>
	<body><h1>正文</h1></body></html>`
	finalURL, _ := url.Parse("https://pay.example.com/post")
	result := &linkPreviewResult{}
	parsePageMetadata(mustDoc(t, html), finalURL, result)
	if result.SiteName != "支付学院" {
		t.Errorf("site_name = %q, 应从标题后缀提取", result.SiteName)
	}
	if result.Lang != "zh-CN" {
		t.Errorf("lang = %q, want zh-CN", result.Lang)
	}
}
