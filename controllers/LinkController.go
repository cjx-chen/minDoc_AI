package controllers

import (
	"bytes"
	"encoding/json"
	"io"
	"net"
	"net/http"
	"net/url"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/PuerkitoBio/goquery"
	"github.com/beego/beego/v2/core/logs"
	"github.com/beego/beego/v2/server/web"
	"github.com/go-shiori/go-readability"
	"github.com/mindoc-org/mindoc/conf"
	"github.com/mindoc-org/mindoc/models"
	"github.com/mindoc-org/mindoc/utils"
	"golang.org/x/net/html/charset"
)

// LinkController 网页收集整理：卡片式收藏外部网页，自动捕获页面信息与正文，可编辑、可点击跳转
type LinkController struct {
	BaseController
}

// linkPreviewResult 链接捕获结果
type linkPreviewResult struct {
	Url           string `json:"url"`
	Title         string `json:"title"`
	Description   string `json:"description"`
	IconUrl       string `json:"icon_url"`
	ImageUrl      string `json:"image_url"`
	SiteName      string `json:"site_name"`
	Lang          string `json:"lang"`
	Author        string `json:"author"`
	PublishedAt   string `json:"published_at"`
	Content       string `json:"content"`
	ContentLength int    `json:"content_length"`
	WordCount     int    `json:"word_count"`
	Fetched       bool   `json:"fetched"`
	Message       string `json:"message,omitempty"`
}

const (
	defaultWebLinkFetchTimeout     = 8
	defaultWebLinkFetchMaxBytes    = 2 * 1024 * 1024
	defaultWebLinkFetchMaxRedirect = 5
	defaultWebLinkContentMaxBytes  = 256 * 1024
	defaultWebLinkCharThreshold    = 150
	defaultWebLinkCacheTTL         = 60
	// 浏览器特征 UA：部分站点会拒绝非浏览器 UA（借鉴 Karakeep normalizeBrowserUserAgent 思路）
	webLinkFetchUserAgent = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
	webLinkAcceptLanguage = "zh-CN,zh;q=0.9,en;q=0.8"
)

// webLinkTrackingParams 需要清除的跟踪参数（URL 规范化，提高去重命中率）
var webLinkTrackingParams = map[string]bool{
	"utm_source": true, "utm_medium": true, "utm_campaign": true, "utm_term": true,
	"utm_content": true, "utm_id": true, "utm_cid": true, "utm_name": true,
	"gclid": true, "gbraid": true, "wbraid": true, "fbclid": true, "msclkid": true,
	"dclid": true, "yclid": true, "twclid": true, "ttclid": true, "igshid": true,
	"spm": true, "scm": true, "share_token": true, "ref_src": true, "ref_url": true,
	"_hsenc": true, "_hsmi": true, "mc_cid": true, "mc_eid": true, "vero_id": true,
}

// blockedHostnames 禁止访问的主机名
var blockedHostnames = map[string]bool{
	"localhost":                true,
	"localhost.localdomain":    true,
	"ip6-localhost":            true,
	"ip6-loopback":             true,
	"broadcasthost":            true,
	"metadata":                 true,
	"metadata.google.internal": true,
	"instance-data":            true,
}

// blockedHostnameSuffixes 禁止访问的主机名后缀
var blockedHostnameSuffixes = []string{
	".localhost",
	".local",
	".localdomain",
	".internal",
}

// blockedCIDRs 禁止访问的网段（IPv4）
var blockedCIDRs = []string{
	"0.0.0.0/8",          // "this" network
	"10.0.0.0/8",         // private
	"100.64.0.0/10",      // CGNAT
	"127.0.0.0/8",        // loopback
	"169.254.0.0/16",     // link-local
	"172.16.0.0/12",      // private
	"192.0.0.0/24",       // IETF protocol assignments
	"192.0.2.0/24",       // TEST-NET-1
	"192.168.0.0/16",     // private
	"198.51.100.0/24",    // TEST-NET-2
	"203.0.113.0/24",     // TEST-NET-3
	"224.0.0.0/4",        // multicast
	"240.0.0.0/4",        // reserved
	"255.255.255.255/32", // broadcast
}

// fakeIPCIDRs 本地代理工具（Clash/Surge 等 fake-ip 模式）使用的保留段（RFC 2544 benchmarking）。
// 公网真实主机不会使用该段：域名解析到该段说明本地存在透明代理，应放行由其转发；
// 该段在公网不可路由，放行不会暴露内网服务（内网服务监听于 RFC1918/环回等地址）。
var fakeIPCIDRs = []string{
	"198.18.0.0/15",
}

// blockedCIDRsV6 禁止访问的网段（IPv6）
var blockedCIDRsV6 = []string{
	"::/128",        // unspecified
	"::1/128",       // loopback
	"fc00::/7",      // unique local
	"fe80::/10",     // link-local
	"ff00::/8",      // multicast
	"2001:db8::/32", // documentation
}

// isWebLinksEnabled 功能开关
func isWebLinksEnabled() bool {
	return web.AppConfig.DefaultBool("enable_web_links", true)
}

func webLinkFetchTimeout() time.Duration {
	seconds := web.AppConfig.DefaultInt("web_link_fetch_timeout", defaultWebLinkFetchTimeout)
	if seconds <= 0 {
		seconds = defaultWebLinkFetchTimeout
	}
	return time.Duration(seconds) * time.Second
}

func webLinkFetchMaxBytes() int64 {
	size := web.AppConfig.DefaultInt("web_link_fetch_max_bytes", defaultWebLinkFetchMaxBytes)
	if size <= 0 {
		size = defaultWebLinkFetchMaxBytes
	}
	return int64(size)
}

func webLinkFetchMaxRedirects() int {
	redirects := web.AppConfig.DefaultInt("web_link_fetch_max_redirects", defaultWebLinkFetchMaxRedirect)
	if redirects < 0 {
		redirects = defaultWebLinkFetchMaxRedirect
	}
	return redirects
}

// webLinkAllowPrivate 是否允许抓取内网地址（默认关闭；仅内网部署按需开启，存在 SSRF 风险）
func webLinkAllowPrivate() bool {
	return web.AppConfig.DefaultBool("web_link_allow_private", false)
}

// webLinkCaptureContent 是否捕获正文快照（默认开启；仅用于库内阅读与检索，与 AI 问答无关）
func webLinkCaptureContent() bool {
	return web.AppConfig.DefaultBool("web_link_capture_content", true)
}

// webLinkContentMaxBytes 正文快照大小上限
func webLinkContentMaxBytes() int {
	size := web.AppConfig.DefaultInt("web_link_content_max_bytes", defaultWebLinkContentMaxBytes)
	if size <= 0 {
		size = defaultWebLinkContentMaxBytes
	}
	return size
}

// webLinkCharThreshold readability 正文字符阈值（默认 500 对中文短文偏高，调低提高提取率）
func webLinkCharThreshold() int {
	threshold := web.AppConfig.DefaultInt("web_link_char_threshold", defaultWebLinkCharThreshold)
	if threshold < 20 {
		threshold = defaultWebLinkCharThreshold
	}
	return threshold
}

// webLinkCacheTTL 捕获结果缓存秒数（避免 预览->收集 重复抓取）
func webLinkCacheTTL() time.Duration {
	seconds := web.AppConfig.DefaultInt("web_link_cache_ttl", defaultWebLinkCacheTTL)
	if seconds < 0 {
		seconds = defaultWebLinkCacheTTL
	}
	return time.Duration(seconds) * time.Second
}

// LinkPage 链接库页面
func (c *LinkController) LinkPage() {
	c.Prepare()
	if !c.EnableAnonymous && !c.isUserLoggedIn() {
		c.Redirect(conf.URLFor("AccountController.Login")+"?url="+url.QueryEscape(conf.BaseUrl+c.Ctx.Request.URL.RequestURI()), 302)
		return
	}

	c.Data["BaseUrl"] = c.BaseUrl()
	c.Data["WebLinksEnabled"] = isWebLinksEnabled()
	c.Data["WebLinksEmbedded"] = c.GetString("embedded") == "1"
	bookId, _ := c.GetInt("book_id")
	c.Data["BookId"] = bookId
	c.TplName = "link/index.tpl"
}

// Preview 捕获链接信息（不落库）
func (c *LinkController) Preview() {
	c.Prepare()
	if !c.EnableAnonymous && !c.isUserLoggedIn() {
		c.JsonResult(401, "请先登录")
		return
	}
	if !isWebLinksEnabled() {
		c.JsonResult(403, "网页链接功能未开启")
		return
	}

	rawURL := strings.TrimSpace(c.GetString("url"))
	if rawURL == "" {
		c.JsonResult(400, "请输入网页链接")
		return
	}

	result := captureLinkPreview(rawURL)
	c.JsonResult(0, "OK", result)
}

// Add 捕获并保存链接（支持标签、笔记）
func (c *LinkController) Add() {
	c.Prepare()
	if !c.EnableAnonymous && !c.isUserLoggedIn() {
		c.JsonResult(401, "请先登录")
		return
	}
	if !isWebLinksEnabled() {
		c.JsonResult(403, "网页链接功能未开启")
		return
	}

	rawURL := strings.TrimSpace(c.GetString("url"))
	if rawURL == "" {
		c.JsonResult(400, "请输入网页链接")
		return
	}
	bookId, _ := c.GetInt("book_id")
	tags := c.GetString("tags")
	note := strings.TrimSpace(c.GetString("note"))

	result := captureLinkPreview(rawURL)
	if result.Title == "" {
		result.Title = result.Url
	}

	if exist, err := models.NewWebLink().FindByURL(bookId, result.Url); err == nil && exist != nil {
		c.JsonResult(0, "链接已存在", map[string]interface{}{
			"link":    exist,
			"existed": true,
			"preview": result,
		})
		return
	}

	link := &models.WebLink{
		BookId:        bookId,
		Url:           result.Url,
		Title:         result.Title,
		Description:   result.Description,
		IconUrl:       result.IconUrl,
		ImageUrl:      result.ImageUrl,
		SiteName:      result.SiteName,
		LinkType:      "external",
		Content:       result.Content,
		Author:        result.Author,
		PublishedAt:   parseWebLinkDate(result.PublishedAt),
		Lang:          result.Lang,
		WordCount:     result.WordCount,
		Tags:          tags,
		Note:          note,
		CreatedBy:     c.Member.MemberId,
		CreatedByName: c.Member.Account,
	}
	if err := link.Insert(); err != nil {
		logs.Error("insert web link failed ->", err)
		c.JsonResult(500, "保存失败："+err.Error())
		return
	}

	c.JsonResult(0, "OK", map[string]interface{}{
		"link":    link,
		"existed": false,
		"preview": result,
	})
}

// Edit 编辑链接卡片（标题/描述/地址/标签/笔记/置顶；地址变更时重新捕获）
func (c *LinkController) Edit() {
	c.Prepare()
	if !c.EnableAnonymous && !c.isUserLoggedIn() {
		c.JsonResult(401, "请先登录")
		return
	}
	if !isWebLinksEnabled() {
		c.JsonResult(403, "网页链接功能未开启")
		return
	}

	linkId, _ := c.GetInt("link_id")
	if linkId <= 0 {
		c.JsonResult(400, "参数错误")
		return
	}
	link, err := models.NewWebLink().Find(linkId)
	if err != nil {
		c.JsonResult(404, "链接不存在")
		return
	}
	if link.CreatedBy != c.Member.MemberId && c.Member.Role != 0 {
		c.JsonResult(403, "无权编辑该链接")
		return
	}

	newURL := strings.TrimSpace(c.GetString("url"))
	if newURL == "" {
		c.JsonResult(400, "网页地址不能为空")
		return
	}
	urlChanged := newURL != link.Url

	if title := strings.TrimSpace(c.GetString("title")); title != "" {
		link.Title = title
	}
	link.Description = strings.TrimSpace(c.GetString("description"))
	link.Tags = c.GetString("tags")
	link.Note = strings.TrimSpace(c.GetString("note"))
	if pinned, err := c.GetInt("pinned"); err == nil {
		if pinned == 1 {
			link.Pinned = 1
		} else {
			link.Pinned = 0
		}
	}

	if urlChanged {
		// 地址变更：重新捕获页面信息与正文
		result := captureLinkPreview(newURL)
		link.Url = result.Url
		link.Content = result.Content
		link.WordCount = result.WordCount
		if result.Fetched {
			link.Title = firstNonEmpty(strings.TrimSpace(c.GetString("title")), result.Title)
			link.Description = firstNonEmpty(link.Description, result.Description)
			link.IconUrl = result.IconUrl
			link.ImageUrl = result.ImageUrl
			link.SiteName = result.SiteName
			link.Author = result.Author
			link.PublishedAt = parseWebLinkDate(result.PublishedAt)
			link.Lang = result.Lang
		}
		if link.Title == "" {
			link.Title = hostOfRawURL(link.Url)
		}
		// 新地址可能与其他卡片重复
		if exist, err := models.NewWebLink().FindByURL(link.BookId, link.Url); err == nil && exist != nil && exist.LinkId != link.LinkId {
			c.JsonResult(409, "该地址已存在另一张卡片")
			return
		}
	}

	if err := link.Update(); err != nil {
		logs.Error("update web link failed ->", err)
		c.JsonResult(500, "保存失败："+err.Error())
		return
	}
	c.JsonResult(0, "OK", map[string]interface{}{"link": link})
}

// Detail 链接详情（含正文快照，供库内阅读）
func (c *LinkController) Detail() {
	c.Prepare()
	if !c.EnableAnonymous && !c.isUserLoggedIn() {
		c.JsonResult(401, "请先登录")
		return
	}
	if !isWebLinksEnabled() {
		c.JsonResult(403, "网页链接功能未开启")
		return
	}

	linkId, _ := c.GetInt("link_id")
	if linkId <= 0 {
		c.JsonResult(400, "参数错误")
		return
	}
	link, err := models.NewWebLink().Find(linkId)
	if err != nil {
		c.JsonResult(404, "链接不存在")
		return
	}
	c.JsonResult(0, "OK", map[string]interface{}{"link": link})
}

// Pin 置顶/取消置顶
func (c *LinkController) Pin() {
	c.Prepare()
	if !c.EnableAnonymous && !c.isUserLoggedIn() {
		c.JsonResult(401, "请先登录")
		return
	}
	if !isWebLinksEnabled() {
		c.JsonResult(403, "网页链接功能未开启")
		return
	}

	linkId, _ := c.GetInt("link_id")
	if linkId <= 0 {
		c.JsonResult(400, "参数错误")
		return
	}
	link, err := models.NewWebLink().Find(linkId)
	if err != nil {
		c.JsonResult(404, "链接不存在")
		return
	}
	if link.CreatedBy != c.Member.MemberId && c.Member.Role != 0 {
		c.JsonResult(403, "无权操作该链接")
		return
	}
	if link.Pinned == 1 {
		link.Pinned = 0
	} else {
		link.Pinned = 1
	}
	if err := link.Update(); err != nil {
		c.JsonResult(500, "操作失败")
		return
	}
	c.JsonResult(0, "OK", map[string]interface{}{"link": link})
}

// Recapture 重新捕获页面信息与正文
func (c *LinkController) Recapture() {
	c.Prepare()
	if !c.EnableAnonymous && !c.isUserLoggedIn() {
		c.JsonResult(401, "请先登录")
		return
	}
	if !isWebLinksEnabled() {
		c.JsonResult(403, "网页链接功能未开启")
		return
	}

	linkId, _ := c.GetInt("link_id")
	if linkId <= 0 {
		c.JsonResult(400, "参数错误")
		return
	}
	link, err := models.NewWebLink().Find(linkId)
	if err != nil {
		c.JsonResult(404, "链接不存在")
		return
	}
	if link.CreatedBy != c.Member.MemberId && c.Member.Role != 0 {
		c.JsonResult(403, "无权操作该链接")
		return
	}

	result := captureLinkPreview(link.Url)
	if result.Fetched {
		link.Title = firstNonEmpty(result.Title, link.Title)
		link.Description = firstNonEmpty(result.Description, link.Description)
		link.IconUrl = result.IconUrl
		link.ImageUrl = result.ImageUrl
		link.SiteName = result.SiteName
		link.Author = result.Author
		link.PublishedAt = parseWebLinkDate(result.PublishedAt)
		link.Lang = result.Lang
		link.Content = result.Content
		link.WordCount = result.WordCount
		if err := link.Update(); err != nil {
			c.JsonResult(500, "更新失败")
			return
		}
	}
	c.JsonResult(0, "OK", map[string]interface{}{
		"link":    link,
		"preview": result,
	})
}

// Lists 链接列表
func (c *LinkController) Lists() {
	c.Prepare()
	if !c.EnableAnonymous && !c.isUserLoggedIn() {
		c.JsonResult(401, "请先登录")
		return
	}
	if !isWebLinksEnabled() {
		c.JsonResult(403, "网页链接功能未开启")
		return
	}

	bookId, _ := c.GetInt("book_id")
	keyword := strings.TrimSpace(c.GetString("keyword"))
	page, _ := c.GetInt("page", 1)
	pageSize, _ := c.GetInt("page_size", 60)
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 200 {
		pageSize = 60
	}

	links, total, err := models.NewWebLink().FindLinks(models.WebLinkQuery{
		BookId:  bookId,
		Keyword: keyword,
		Offset:  (page - 1) * pageSize,
		Limit:   pageSize,
	})
	if err != nil {
		logs.Error("query web links failed ->", err)
		c.JsonResult(500, "查询失败")
		return
	}

	tags, err := models.NewWebLink().FindTags(bookId)
	if err != nil {
		logs.Warn("query web link tags failed ->", err)
	}

	c.JsonResult(0, "OK", map[string]interface{}{
		"list":  links,
		"total": total,
		"page":  page,
		"tags":  tags,
	})
}

// Delete 删除链接
func (c *LinkController) Delete() {
	c.Prepare()
	if !c.EnableAnonymous && !c.isUserLoggedIn() {
		c.JsonResult(401, "请先登录")
		return
	}
	if !isWebLinksEnabled() {
		c.JsonResult(403, "网页链接功能未开启")
		return
	}

	linkId, _ := c.GetInt("link_id")
	if linkId <= 0 {
		c.JsonResult(400, "参数错误")
		return
	}

	link, err := models.NewWebLink().Find(linkId)
	if err != nil {
		c.JsonResult(404, "链接不存在")
		return
	}
	if link.CreatedBy != c.Member.MemberId && c.Member.Role != 0 {
		c.JsonResult(403, "无权删除该链接")
		return
	}
	if err := link.Delete(); err != nil {
		c.JsonResult(500, "删除失败")
		return
	}
	c.JsonResult(0, "OK")
}

// captureLinkPreview 安全抓取目标页面并解析元信息与正文快照
// （元信息优先级对齐 metascraper 规则链；正文提取用 go-readability；SSRF 防护借鉴 Linkwarden）
func captureLinkPreview(rawURL string) *linkPreviewResult {
	result := &linkPreviewResult{Url: rawURL}

	// URL 规范化（去跟踪参数等），提高去重命中率
	normalized := normalizeWebLinkURL(rawURL)
	if normalized != rawURL {
		rawURL = normalized
		result.Url = rawURL
	}

	// 短 TTL 缓存：避免 预览->收集 对同一 URL 重复抓取
	if cached, ok := getCachedCapture(rawURL); ok {
		cached.Url = rawURL
		return cached
	}

	parsed, err := validateExternalURL(rawURL)
	if err != nil {
		result.Message = "链接不安全或无法访问：" + err.Error()
		result.Title = hostOfRawURL(rawURL)
		result.SiteName = result.Title
		return result
	}
	result.Url = parsed.String()

	raw, finalURL, err := safeFetchPage(parsed)
	if err != nil {
		logs.Warn("fetch web link failed ->", rawURL, err)
		result.Message = "自动捕获失败，已按域名保存：" + err.Error()
		result.Title = parsed.Hostname()
		result.SiteName = parsed.Hostname()
		return result
	}
	result.Url = finalURL.String()
	result.Fetched = true

	doc, err := goquery.NewDocumentFromReader(bytes.NewReader(raw))
	if err != nil {
		result.Message = "页面解析失败，已按域名保存"
		result.Title = finalURL.Hostname()
		result.SiteName = finalURL.Hostname()
		return result
	}

	parsePageMetadata(doc, finalURL, result)

	// 规范 URL（metascraper-url 链，同主机才接受）：去重更准、卡片地址更干净
	if canonical := resolveCanonicalURL(doc, finalURL); canonical != "" {
		result.Url = canonical
	}

	// 正文快照（库内阅读用，与 AI 问答无关）
	if webLinkCaptureContent() {
		content := extractPageContent(bytes.NewReader(raw), finalURL)
		if content == "" {
			// readability 兜底：描述或页面可见文本前缀
			content = fallbackPageContent(doc, result.Description)
		}
		if content != "" {
			result.Content = content
			result.ContentLength = len([]rune(content))
			result.WordCount = result.ContentLength
		}
	}
	setCachedCapture(rawURL, result)
	return result
}

// extractPageContent 用 readability 提取正文并转为纯文本快照（阈值调低以适配中文短文）
func extractPageContent(body io.Reader, pageURL *url.URL) string {
	parser := readability.NewParser()
	parser.CharThresholds = webLinkCharThreshold()
	article, err := parser.Parse(body, pageURL)
	if err != nil {
		logs.Warn("extract web link content failed ->", pageURL.String(), err)
		return ""
	}
	text := strings.TrimSpace(utils.StripTags(article.Content))
	if text == "" {
		text = strings.TrimSpace(article.TextContent)
	}
	if text == "" {
		return ""
	}
	// 压缩多余空白行
	lines := make([]string, 0, 64)
	for _, line := range strings.Split(text, "\n") {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}
		lines = append(lines, line)
	}
	text = strings.Join(lines, "\n")
	return truncateRunes(text, webLinkContentMaxBytes())
}

// parseWebLinkDate 解析多种日期格式（RFC3339 / ISO / 日期时间 / 纯日期），失败返回 nil
func parseWebLinkDate(value string) *time.Time {
	value = strings.TrimSpace(value)
	if value == "" {
		return nil
	}
	layouts := []string{
		time.RFC3339,
		"2006-01-02T15:04:05Z0700",
		"2006-01-02T15:04:05",
		"2006-01-02 15:04:05",
		"2006-01-02 15:04",
		"2006/01/02 15:04:05",
		"2006/01/02",
		"2006-01-02",
		"2006年01月02日",
		"2006年1月2日",
	}
	for _, layout := range layouts {
		if parsed, err := time.ParseInLocation(layout, value, time.Local); err == nil {
			return &parsed
		}
	}
	return nil
}

// truncateRunes 按字符数截断（UTF-8 安全）
func truncateRunes(text string, max int) string {
	runes := []rune(text)
	if max <= 0 || len(runes) <= max {
		return text
	}
	return string(runes[:max])
}

// parsePageMetadata 从 HTML 文档提取元信息，规则优先级对齐 metascraper：
// 标题 og:title -> twitter:title -> <title> -> JSON-LD headline -> .post-title -> .entry-title -> h1[class*=title]
// 描述 og:description -> twitter:description -> meta[description] -> meta[itemprop=description] -> JSON-LD description/articleBody
// 图片 og:image:secure_url -> og:image:url -> og:image -> twitter:image -> itemprop=image -> JSON-LD image -> 正文首图
// 作者 JSON-LD author.name -> meta[author] -> article:author -> a[rel=author]
// 发布时间 JSON-LD datePublished -> meta[property*=published_time] -> time[datetime]
func parsePageMetadata(doc *goquery.Document, finalURL *url.URL, result *linkPreviewResult) {
	jsonld := extractJSONLD(doc)

	result.Title = firstNonEmpty(
		metaContent(doc, `meta[property="og:title"]`),
		metaContent(doc, `meta[name="twitter:title"]`),
		strings.TrimSpace(doc.Find("title").First().Text()),
		jsonldString(jsonld, "headline"),
		jsonldString(jsonld, "name"),
		strings.TrimSpace(doc.Find(".post-title").First().Text()),
		strings.TrimSpace(doc.Find(".entry-title").First().Text()),
		strings.TrimSpace(doc.Find(`h1[class*="title"]`).First().Text()),
		finalURL.Hostname(),
	)
	result.Description = firstNonEmpty(
		metaContent(doc, `meta[property="og:description"]`),
		metaContent(doc, `meta[name="twitter:description"]`),
		metaContent(doc, `meta[name="description"]`),
		metaContent(doc, `meta[itemprop="description"]`),
		jsonldString(jsonld, "description"),
		truncateRunes(jsonldString(jsonld, "articleBody"), 2000),
	)
	// 站点名（metascraper-publisher 链）：og:site_name -> JSON-LD publisher.name -> application-name -> 标题后缀「 - 站点」-> hostname
	result.SiteName = firstNonEmpty(
		metaContent(doc, `meta[property="og:site_name"]`),
		jsonldString(jsonld, "publisher", "name"),
		metaContent(doc, `meta[name="application-name"]`),
		metaContent(doc, `meta[name="app-title"]`),
		metaContent(doc, `meta[property="app_name"]`),
		publisherFromTitle(result.Title),
		finalURL.Hostname(),
	)
	// 语言（metascraper-lang 链）
	result.Lang = normalizeLang(firstNonEmpty(
		metaContent(doc, `meta[property="og:locale"]`),
		metaContent(doc, `meta[itemprop="inLanguage"]`),
		doc.Find("html").First().AttrOr("lang", ""),
	))
	result.Author = firstNonEmpty(
		jsonldString(jsonld, "author", "name"),
		metaContent(doc, `meta[name="author"]`),
		metaContent(doc, `meta[property="article:author"]`),
		strings.TrimSpace(doc.Find(`a[rel="author"]`).First().Text()),
	)
	result.PublishedAt = firstNonEmpty(
		jsonldString(jsonld, "datePublished"),
		jsonldString(jsonld, "dateCreated"),
		metaContent(doc, `meta[property*="published_time"]`),
		doc.Find("time[datetime]").First().AttrOr("datetime", ""),
	)

	imageURL := firstNonEmpty(
		metaContent(doc, `meta[property="og:image:secure_url"]`),
		metaContent(doc, `meta[property="og:image:url"]`),
		metaContent(doc, `meta[property="og:image"]`),
		metaContent(doc, `meta[name="twitter:image:src"]`),
		metaContent(doc, `meta[name="twitter:image"]`),
		metaContent(doc, `meta[itemprop="image"]`),
		jsonldString(jsonld, "image", "url"),
		jsonldString(jsonld, "image"),
		// 正文首图兜底（无 og:image 的内容页也能有真实封面）
		doc.Find("article img[src]").First().AttrOr("src", ""),
		doc.Find("#content img[src]").First().AttrOr("src", ""),
		doc.Find(`img[src]:not([aria-hidden="true"])`).First().AttrOr("src", ""),
	)
	if imageURL != "" {
		result.ImageUrl = resolveURL(finalURL, imageURL)
	}

	// 图标链：favicon 选优（尺寸×类型权重）-> 品牌 logo（metascraper-logo 规则）-> 约定 favicon.ico
	if iconURL := firstNonEmpty(pickBestFavicon(doc, finalURL), pickBestLogo(doc, finalURL, jsonld)); iconURL != "" {
		result.IconUrl = iconURL
	} else {
		result.IconUrl = finalURL.Scheme + "://" + finalURL.Host + "/favicon.ico"
	}
}

// publisherFromTitle 从标题提取站点名（metascraper-publisher 的 getFromTitle）：
// "文章标题 - 知乎" -> "知乎"；支持 - | — ｜ 分隔，迭代剥离多层后缀
var titlePublisherPattern = regexp.MustCompile(`^.*?[-|—｜]\s+(.+)$`)

func publisherFromTitle(title string) string {
	title = strings.TrimSpace(title)
	if title == "" {
		return ""
	}
	matches := titlePublisherPattern.FindStringSubmatch(title)
	if len(matches) != 2 {
		return ""
	}
	result := strings.TrimSpace(matches[1])
	for i := 0; i < 3; i++ {
		next := titlePublisherPattern.FindStringSubmatch(result)
		if len(next) != 2 {
			break
		}
		trimmed := strings.TrimSpace(next[1])
		if trimmed == "" || trimmed == result {
			break
		}
		result = trimmed
	}
	if len([]rune(result)) > 50 {
		return ""
	}
	return result
}

// normalizeLang 标准化语言标签（zh_CN -> zh-CN）
func normalizeLang(value string) string {
	value = strings.TrimSpace(value)
	if value == "" {
		return ""
	}
	value = strings.ReplaceAll(value, "_", "-")
	if idx := strings.Index(value, ";"); idx > 0 {
		value = value[:idx]
	}
	return truncateRunes(value, 35)
}

// pickBestLogo 按 metascraper-logo 规则挑选品牌 logo（作为 favicon 的兜底）
func pickBestLogo(doc *goquery.Document, finalURL *url.URL, jsonld map[string]interface{}) string {
	candidates := []string{
		metaContent(doc, `meta[property="og:logo"]`),
		metaContent(doc, `meta[itemprop="logo"]`),
		doc.Find(`img[itemprop="logo"]`).First().AttrOr("src", ""),
		doc.Find(`[itemprop="logo"] img`).First().AttrOr("src", ""),
		jsonldString(jsonld, "brand", "logo", "url"),
		jsonldString(jsonld, "organization", "logo", "url"),
		jsonldString(jsonld, "publisher", "logo", "url"),
		jsonldString(jsonld, "place", "logo", "url"),
		jsonldString(jsonld, "product", "logo", "url"),
		jsonldString(jsonld, "service", "logo", "url"),
		jsonldString(jsonld, "logo", "url"),
	}
	for _, candidate := range candidates {
		if resolved := resolveURL(finalURL, strings.TrimSpace(candidate)); resolved != "" {
			return resolved
		}
	}
	return ""
}

// resolveCanonicalURL 解析规范 URL（metascraper-url 链）：og:url -> twitter:url ->
// link[rel=canonical] -> link[rel=alternate][hreflang=x-default]；
// 仅接受与抓取地址同主机的规范地址（防跨站劫持卡片）
func resolveCanonicalURL(doc *goquery.Document, finalURL *url.URL) string {
	candidates := []string{
		metaContent(doc, `meta[property="og:url"]`),
		metaContent(doc, `meta[name="twitter:url"]`),
		doc.Find(`link[rel="canonical"]`).First().AttrOr("href", ""),
		doc.Find(`link[rel="alternate"][hreflang="x-default"]`).First().AttrOr("href", ""),
	}
	for _, candidate := range candidates {
		resolved := resolveURL(finalURL, strings.TrimSpace(candidate))
		if resolved == "" {
			continue
		}
		parsed, err := url.Parse(resolved)
		if err != nil || parsed.Hostname() == "" {
			continue
		}
		if !strings.EqualFold(parsed.Hostname(), finalURL.Hostname()) {
			continue
		}
		return normalizeWebLinkURL(resolved)
	}
	return ""
}

// pickBestFavicon 按 metascraper-logo-favicon 的思路挑选最佳图标：
// priority = 尺寸 * 类型权重（apple/android 5 > png 5 > jpg 4 > svg 3 > ico 2 > 其他 1）
func pickBestFavicon(doc *goquery.Document, finalURL *url.URL) string {
	type candidate struct {
		url      string
		priority int
	}
	best := candidate{}
	consider := func(href, sizes string) {
		href = strings.TrimSpace(href)
		if href == "" {
			return
		}
		resolved := resolveURL(finalURL, href)
		if resolved == "" {
			return
		}
		width := 0
		if sizes != "" {
			parts := strings.Split(strings.ReplaceAll(sizes, "×", "x"), "x")
			if len(parts) > 0 {
				if w, err := strconv.Atoi(strings.TrimSpace(parts[0])); err == nil {
					width = w
				}
			}
		}
		if width == 0 {
			width = 1
		}
		lower := strings.ToLower(resolved)
		weight := 1
		switch {
		case strings.Contains(lower, "apple") || strings.Contains(lower, "android"):
			weight = 5
		case strings.HasSuffix(lower, ".png"):
			weight = 5
		case strings.HasSuffix(lower, ".jpg") || strings.HasSuffix(lower, ".jpeg"):
			weight = 4
		case strings.HasSuffix(lower, ".svg"):
			weight = 3
		case strings.HasSuffix(lower, ".ico"):
			weight = 2
		}
		priority := width * weight
		if priority > best.priority {
			best = candidate{url: resolved, priority: priority}
		}
	}
	doc.Find(`link[rel]`).Each(func(_ int, s *goquery.Selection) {
		rel := strings.ToLower(s.AttrOr("rel", ""))
		if !strings.Contains(rel, "icon") {
			return
		}
		consider(s.AttrOr("href", ""), s.AttrOr("sizes", ""))
	})
	return best.url
}

// extractJSONLD 合并页面中所有 JSON-LD 对象（支持 @graph 与数组根）
func extractJSONLD(doc *goquery.Document) map[string]interface{} {
	merged := make(map[string]interface{})
	doc.Find(`script[type="application/ld+json"]`).Each(func(_ int, s *goquery.Selection) {
		text := strings.TrimSpace(s.Text())
		if text == "" {
			return
		}
		var data interface{}
		if err := json.Unmarshal([]byte(text), &data); err != nil {
			return
		}
		collectJSONLD(data, merged)
	})
	return merged
}

// collectJSONLD 递归收集 JSON-LD 顶层字段（先到先得；嵌套对象原样保留以支持 author.name / image.url 路径）
func collectJSONLD(data interface{}, merged map[string]interface{}) {
	switch value := data.(type) {
	case map[string]interface{}:
		if graph, ok := value["@graph"]; ok {
			collectJSONLD(graph, merged)
		}
		for key, item := range value {
			if key == "@graph" {
				continue
			}
			if _, exists := merged[key]; exists {
				continue
			}
			merged[key] = item
		}
	case []interface{}:
		for _, item := range value {
			collectJSONLD(item, merged)
		}
	}
}

// jsonldString 按路径读取 JSON-LD 字符串字段（支持 author.name / image.url 等嵌套）
func jsonldString(jsonld map[string]interface{}, path ...string) string {
	if len(jsonld) == 0 || len(path) == 0 {
		return ""
	}
	var current interface{} = jsonld
	for _, key := range path {
		switch node := current.(type) {
		case map[string]interface{}:
			next, ok := node[strings.ToLower(key)]
			if !ok {
				// 大小写不敏感匹配
				for k, v := range node {
					if strings.EqualFold(k, key) {
						next, ok = v, true
						break
					}
				}
			}
			if !ok {
				return ""
			}
			current = next
		case []interface{}:
			if len(node) == 0 {
				return ""
			}
			current = node[0]
		default:
			return ""
		}
	}
	switch value := current.(type) {
	case string:
		return strings.TrimSpace(value)
	case float64:
		return strconv.FormatFloat(value, 'f', -1, 64)
	default:
		return ""
	}
}

// fallbackPageContent readability 无结果时的兜底：优先描述，其次页面可见文本前缀
func fallbackPageContent(doc *goquery.Document, description string) string {
	if text := truncateRunes(strings.TrimSpace(description), 500); text != "" {
		return text
	}
	clone := doc.Selection.Clone()
	clone.Find("script,style,noscript,iframe").Remove()
	text := strings.Join(strings.Fields(clone.Find("body").Text()), " ")
	return truncateRunes(strings.TrimSpace(text), 500)
}

// normalizeWebLinkURL URL 规范化：去跟踪参数、小写主机名、去默认端口（保留 fragment 供 SPA 跳转）
func normalizeWebLinkURL(rawURL string) string {
	rawURL = strings.TrimSpace(rawURL)
	if rawURL == "" || !strings.Contains(rawURL, "://") {
		return rawURL
	}
	parsed, err := url.Parse(rawURL)
	if err != nil {
		return rawURL
	}
	parsed.Host = strings.ToLower(parsed.Host)
	if parsed.Scheme == "http" && strings.HasSuffix(parsed.Host, ":80") {
		parsed.Host = strings.TrimSuffix(parsed.Host, ":80")
	}
	if parsed.Scheme == "https" && strings.HasSuffix(parsed.Host, ":443") {
		parsed.Host = strings.TrimSuffix(parsed.Host, ":443")
	}
	query := parsed.Query()
	changed := false
	for key := range query {
		if webLinkTrackingParams[strings.ToLower(key)] {
			query.Del(key)
			changed = true
		}
	}
	if changed {
		parsed.RawQuery = query.Encode()
	}
	return parsed.String()
}

// webLinkCaptureCache 捕获结果短缓存（避免 预览->收集 重复抓取同一 URL）
var webLinkCaptureCache = struct {
	sync.RWMutex
	items map[string]linkCaptureCacheItem
}{items: make(map[string]linkCaptureCacheItem)}

type linkCaptureCacheItem struct {
	result   *linkPreviewResult
	expireAt time.Time
}

func getCachedCapture(key string) (*linkPreviewResult, bool) {
	ttl := webLinkCacheTTL()
	if ttl <= 0 {
		return nil, false
	}
	webLinkCaptureCache.RLock()
	item, ok := webLinkCaptureCache.items[key]
	webLinkCaptureCache.RUnlock()
	if !ok || time.Now().After(item.expireAt) {
		return nil, false
	}
	copied := *item.result
	return &copied, true
}

func setCachedCapture(key string, result *linkPreviewResult) {
	ttl := webLinkCacheTTL()
	if ttl <= 0 || result == nil {
		return
	}
	webLinkCaptureCache.Lock()
	webLinkCaptureCache.items[key] = linkCaptureCacheItem{
		result:   result,
		expireAt: time.Now().Add(ttl),
	}
	webLinkCaptureCache.Unlock()
}

// safeFetchPage 带限制地抓取页面（超时/大小/跳转/Content-Type），返回解码后的页面字节与最终 URL
func safeFetchPage(parsed *url.URL) ([]byte, *url.URL, error) {
	client := &http.Client{
		Timeout: webLinkFetchTimeout(),
		CheckRedirect: func(req *http.Request, via []*http.Request) error {
			if len(via) >= webLinkFetchMaxRedirects() {
				return &linkFetchError{msg: "重定向次数过多"}
			}
			// 重定向目标同样需要 SSRF 校验
			if _, err := validateExternalURL(req.URL.String()); err != nil {
				return err
			}
			return nil
		},
	}

	req, err := http.NewRequest(http.MethodGet, parsed.String(), nil)
	if err != nil {
		return nil, nil, err
	}
	req.Header.Set("User-Agent", webLinkFetchUserAgent)
	req.Header.Set("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8")
	req.Header.Set("Accept-Language", webLinkAcceptLanguage)

	// 429/5xx 或网络错误重试一次（借鉴 Karakeep shouldRetryCrawlStatusCode）
	resp, err := client.Do(req)
	if err == nil && (resp.StatusCode == 429 || resp.StatusCode >= 500) {
		resp.Body.Close()
		time.Sleep(400 * time.Millisecond)
		retryReq := req.Clone(req.Context())
		resp, err = client.Do(retryReq)
	}
	if err != nil {
		return nil, nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, nil, &linkFetchError{msg: "HTTP " + strconv.Itoa(resp.StatusCode)}
	}
	contentType := resp.Header.Get("Content-Type")
	if contentType != "" && !strings.Contains(strings.ToLower(contentType), "text/html") &&
		!strings.Contains(strings.ToLower(contentType), "application/xhtml") {
		return nil, nil, &linkFetchError{msg: "非网页内容（" + contentType + "）"}
	}

	raw, err := io.ReadAll(io.LimitReader(resp.Body, webLinkFetchMaxBytes()))
	if err != nil {
		return nil, nil, err
	}
	// 按 Content-Type / meta 声明转码为 UTF-8（GBK 等页面）
	decoder, err := charset.NewReader(bytes.NewReader(raw), contentType)
	if err == nil {
		if decoded, err := io.ReadAll(io.LimitReader(decoder, webLinkFetchMaxBytes())); err == nil && len(decoded) > 0 {
			return decoded, resp.Request.URL, nil
		}
	}
	return raw, resp.Request.URL, nil
}

// linkFetchError 抓取错误
type linkFetchError struct {
	msg string
}

func (e *linkFetchError) Error() string {
	return e.msg
}

// validateExternalURL 校验外部 URL，返回解析结果；非公网地址返回错误
func validateExternalURL(rawURL string) (*url.URL, error) {
	rawURL = strings.TrimSpace(rawURL)
	if rawURL == "" {
		return nil, &linkFetchError{msg: "链接为空"}
	}
	if !strings.Contains(rawURL, "://") {
		rawURL = "http://" + rawURL
	}
	parsed, err := url.Parse(rawURL)
	if err != nil {
		return nil, &linkFetchError{msg: "链接格式错误"}
	}
	if parsed.Scheme != "http" && parsed.Scheme != "https" {
		return nil, &linkFetchError{msg: "仅支持 http/https 链接"}
	}
	if parsed.User != nil {
		return nil, &linkFetchError{msg: "链接不允许包含账号凭证"}
	}
	host := parsed.Hostname()
	if host == "" {
		return nil, &linkFetchError{msg: "链接缺少主机名"}
	}
	if blockedHostnames[strings.ToLower(host)] {
		return nil, &linkFetchError{msg: "禁止访问内网地址"}
	}
	lowerHost := strings.ToLower(host)
	for _, suffix := range blockedHostnameSuffixes {
		if strings.HasSuffix(lowerHost, suffix) {
			return nil, &linkFetchError{msg: "禁止访问内网地址"}
		}
	}

	// DNS 解析后校验 IP（防 SSRF 基础版）；web_link_allow_private=true 时跳过（仅限内网部署）
	if !webLinkAllowPrivate() {
		ips, err := net.LookupIP(host)
		if err != nil {
			return nil, &linkFetchError{msg: "域名解析失败"}
		}
		if len(ips) == 0 {
			return nil, &linkFetchError{msg: "域名解析失败"}
		}
		for _, ip := range ips {
			if isBlockedIP(ip) {
				return nil, &linkFetchError{msg: "禁止访问内网地址"}
			}
		}
	}
	return parsed, nil
}

// isBlockedIP 判断 IP 是否落在禁止网段
func isBlockedIP(ip net.IP) bool {
	if ip == nil {
		return true
	}
	// 本地代理 fake-ip 段：放行（详见 fakeIPCIDRs 注释）
	if isFakeIP(ip) {
		return false
	}
	if ip.IsLoopback() || ip.IsPrivate() || ip.IsLinkLocalUnicast() ||
		ip.IsLinkLocalMulticast() || ip.IsInterfaceLocalMulticast() ||
		ip.IsMulticast() || ip.IsUnspecified() {
		return true
	}
	cidrs := blockedCIDRs
	if ip.To4() == nil {
		cidrs = blockedCIDRsV6
	}
	for _, cidr := range cidrs {
		_, network, err := net.ParseCIDR(cidr)
		if err != nil {
			continue
		}
		if network.Contains(ip) {
			return true
		}
	}
	return false
}

// isFakeIP 判断是否本地代理 fake-ip 段地址
func isFakeIP(ip net.IP) bool {
	for _, cidr := range fakeIPCIDRs {
		_, network, err := net.ParseCIDR(cidr)
		if err != nil {
			continue
		}
		if network.Contains(ip) {
			return true
		}
	}
	return false
}

// metaContent 读取 meta 标签 content
func metaContent(doc *goquery.Document, selector string) string {
	value, exists := doc.Find(selector).First().Attr("content")
	if !exists {
		return ""
	}
	return strings.TrimSpace(value)
}

// firstNonEmpty 返回第一个非空字符串
func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if trimmed := strings.TrimSpace(value); trimmed != "" {
			return trimmed
		}
	}
	return ""
}

// hostOfRawURL 尽力提取 URL 主机名（用于降级展示）
func hostOfRawURL(rawURL string) string {
	if !strings.Contains(rawURL, "://") {
		rawURL = "http://" + rawURL
	}
	if parsed, err := url.Parse(rawURL); err == nil && parsed.Hostname() != "" {
		return parsed.Hostname()
	}
	return rawURL
}

// resolveURL 将相对地址补全为绝对地址
func resolveURL(base *url.URL, ref string) string {
	ref = strings.TrimSpace(ref)
	if ref == "" {
		return ""
	}
	if strings.HasPrefix(ref, "//") {
		return base.Scheme + ":" + ref
	}
	if strings.HasPrefix(ref, "http://") || strings.HasPrefix(ref, "https://") {
		return ref
	}
	if parsed, err := url.Parse(ref); err == nil {
		return base.ResolveReference(parsed).String()
	}
	return ref
}
