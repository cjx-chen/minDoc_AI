package controllers

import (
	"encoding/json"
	"fmt"
	"hash/fnv"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/beego/beego/v2/client/orm"
	"github.com/beego/beego/v2/core/logs"
	"github.com/beego/beego/v2/server/web"
	"github.com/mindoc-org/mindoc/models"
	"github.com/russross/blackfriday/v2"
)

var openAPIDocIdentifyPattern = regexp.MustCompile(`^[a-z]+[a-zA-Z0-9_.-]*$`)

type OpenAPIController struct {
	BaseController
}

type importMarkdownRequest struct {
	BookIdentify   string `json:"book_identify"`
	Path           string `json:"path"`
	Title          string `json:"title"`
	Identify       string `json:"identify"`
	Markdown       string `json:"markdown"`
	Overwrite      bool   `json:"overwrite"`
	AutoCreateDirs *bool  `json:"auto_create_dirs"`
	OrderSort      int    `json:"order_sort"`
	MemberId       int    `json:"member_id"`
}

type importMarkdownResponse struct {
	BookIdentify string `json:"book_identify"`
	DocumentId   int    `json:"document_id"`
	Identify     string `json:"identify"`
	Title        string `json:"title"`
	Path         string `json:"path"`
	URL          string `json:"url"`
	Created      bool   `json:"created"`
	Updated      bool   `json:"updated"`
}

// ImportMarkdown lets trusted internal systems create or update a Markdown document.
func (c *OpenAPIController) ImportMarkdown() {
	if !web.AppConfig.DefaultBool("openapi_markdown_import_enabled", false) {
		c.Ctx.Output.SetStatus(http.StatusForbidden)
		c.JsonResult(403, "OpenAPI Markdown import is disabled")
	}
	if !c.verifyMarkdownImportToken() {
		c.Ctx.Output.SetStatus(http.StatusUnauthorized)
		c.JsonResult(401, "invalid OpenAPI token")
	}

	var req importMarkdownRequest
	if err := c.bindImportMarkdownRequest(&req); err != nil {
		c.Ctx.Output.SetStatus(http.StatusBadRequest)
		c.JsonResult(400, "invalid request: "+err.Error())
	}

	req.BookIdentify = strings.TrimSpace(req.BookIdentify)
	req.Path = strings.TrimSpace(req.Path)
	req.Title = strings.TrimSpace(req.Title)
	req.Identify = strings.TrimSpace(req.Identify)

	if req.BookIdentify == "" {
		c.Ctx.Output.SetStatus(http.StatusBadRequest)
		c.JsonResult(400, "book_identify is required")
	}

	segments, err := normalizeMarkdownImportPath(req.Path)
	if err != nil {
		c.Ctx.Output.SetStatus(http.StatusBadRequest)
		c.JsonResult(400, err.Error())
	}

	if req.Title == "" {
		req.Title = stripMarkdownExtension(segments[len(segments)-1])
	}
	if req.Title == "" {
		req.Title = "Untitled"
	}

	autoCreateDirs := true
	if req.AutoCreateDirs != nil {
		autoCreateDirs = *req.AutoCreateDirs
	}

	book, err := models.NewBook().FindByIdentify(req.BookIdentify)
	if err != nil {
		if err == orm.ErrNoRows || err == models.ErrDataNotExist {
			c.Ctx.Output.SetStatus(http.StatusNotFound)
			c.JsonResult(404, "book not found")
		}
		logs.Error("OpenAPI markdown import find book failed ->", req.BookIdentify, err)
		c.Ctx.Output.SetStatus(http.StatusInternalServerError)
		c.JsonResult(500, "find book failed")
	}

	memberId := req.MemberId
	if memberId <= 0 {
		memberId = book.MemberId
	}

	parentId, err := c.ensureMarkdownImportParents(book.BookId, memberId, segments[:len(segments)-1], autoCreateDirs)
	if err != nil {
		c.Ctx.Output.SetStatus(http.StatusBadRequest)
		c.JsonResult(400, err.Error())
	}

	docIdentify := req.Identify
	if docIdentify == "" {
		docIdentify = makeMarkdownImportIdentify(segments)
	} else if !isValidMarkdownImportIdentify(docIdentify) {
		c.Ctx.Output.SetStatus(http.StatusBadRequest)
		c.JsonResult(400, "identify must match ^[a-z]+[a-zA-Z0-9_.-]*$ and be no longer than 100 characters")
	}

	content := renderImportedMarkdown(req.Markdown)
	now := time.Now().Unix()
	doc, findErr := models.NewDocument().FindByIdentityFirst(docIdentify, book.BookId)
	created := false
	updated := false

	if findErr != nil && findErr != orm.ErrNoRows && findErr != models.ErrDataNotExist {
		logs.Error("OpenAPI markdown import find document failed ->", docIdentify, findErr)
		c.Ctx.Output.SetStatus(http.StatusInternalServerError)
		c.JsonResult(500, "find document failed")
	}

	if findErr == nil && doc.DocumentId > 0 {
		if !req.Overwrite {
			c.Ctx.Output.SetStatus(http.StatusConflict)
			c.JsonResult(409, "document already exists")
		}
		doc.DocumentName = req.Title
		doc.ParentId = parentId
		doc.Markdown = req.Markdown
		doc.Content = content
		doc.ModifyAt = memberId
		doc.Version = now
		if req.OrderSort > 0 {
			doc.OrderSort = req.OrderSort
		}
		updated = true
	} else {
		doc = models.NewDocument()
		doc.BookId = book.BookId
		doc.ParentId = parentId
		doc.Identify = docIdentify
		doc.DocumentName = req.Title
		doc.Markdown = req.Markdown
		doc.Content = content
		doc.MemberId = memberId
		doc.ModifyAt = memberId
		doc.Version = now
		doc.IsOpen = 0
		if req.OrderSort > 0 {
			doc.OrderSort = req.OrderSort
		}
		created = true
	}

	if err := doc.InsertOrUpdate(); err != nil {
		logs.Error("OpenAPI markdown import save document failed ->", docIdentify, err)
		c.Ctx.Output.SetStatus(http.StatusInternalServerError)
		c.JsonResult(500, "save document failed")
	}

	doc.Lang = web.AppConfig.DefaultString("default_lang", "zh-cn")
	if err := doc.ReleaseContent(); err != nil {
		logs.Error("OpenAPI markdown import release document failed ->", docIdentify, err)
		c.Ctx.Output.SetStatus(http.StatusInternalServerError)
		c.JsonResult(500, "release document failed")
	}

	c.JsonResult(0, "ok", importMarkdownResponse{
		BookIdentify: book.Identify,
		DocumentId:   doc.DocumentId,
		Identify:     doc.Identify,
		Title:        doc.DocumentName,
		Path:         strings.Join(segments, "/"),
		URL:          "/docs/" + book.Identify + "/" + doc.Identify,
		Created:      created,
		Updated:      updated,
	})
}

func (c *OpenAPIController) verifyMarkdownImportToken() bool {
	expected := strings.TrimSpace(web.AppConfig.DefaultString("openapi_markdown_import_token", ""))
	if expected == "" {
		return false
	}

	headerName := strings.TrimSpace(web.AppConfig.DefaultString("openapi_markdown_import_auth_header", "Authorization"))
	if headerName == "" {
		headerName = "Authorization"
	}
	actual := strings.TrimSpace(c.Ctx.Input.Header(headerName))
	prefix := web.AppConfig.DefaultString("openapi_markdown_import_auth_prefix", "Bearer ")
	if !strings.EqualFold(strings.TrimSpace(prefix), "none") && prefix != "" && strings.HasPrefix(actual, prefix) {
		actual = strings.TrimSpace(strings.TrimPrefix(actual, prefix))
	}
	if actual == "" {
		actual = strings.TrimSpace(c.Ctx.Input.Header("X-MinDoc-Token"))
	}
	if actual == "" {
		actual = strings.TrimSpace(c.GetString("token"))
	}
	return actual == expected
}

func (c *OpenAPIController) bindImportMarkdownRequest(req *importMarkdownRequest) error {
	body := strings.TrimSpace(string(c.Ctx.Input.RequestBody))
	if body != "" {
		if err := json.Unmarshal([]byte(body), req); err != nil {
			return err
		}
	}

	if req.BookIdentify == "" {
		req.BookIdentify = c.GetString("book_identify")
	}
	if req.Path == "" {
		req.Path = c.GetString("path")
	}
	if req.Title == "" {
		req.Title = c.GetString("title")
	}
	if req.Identify == "" {
		req.Identify = c.GetString("identify")
	}
	if req.Markdown == "" {
		req.Markdown = c.GetString("markdown")
	}
	if value := strings.TrimSpace(c.GetString("overwrite")); value != "" {
		req.Overwrite, _ = strconv.ParseBool(value)
	}
	if value := strings.TrimSpace(c.GetString("auto_create_dirs")); value != "" {
		autoCreateDirs, _ := strconv.ParseBool(value)
		req.AutoCreateDirs = &autoCreateDirs
	}
	if req.OrderSort <= 0 {
		req.OrderSort, _ = c.GetInt("order_sort", 0)
	}
	if req.MemberId <= 0 {
		req.MemberId, _ = c.GetInt("member_id", 0)
	}
	return nil
}

func (c *OpenAPIController) ensureMarkdownImportParents(bookId, memberId int, segments []string, autoCreate bool) (int, error) {
	parentId := 0
	for index, segment := range segments {
		prefix := segments[:index+1]
		identify := makeMarkdownImportIdentify(prefix)
		doc, err := models.NewDocument().FindByIdentityFirst(identify, bookId)
		if err == nil && doc.DocumentId > 0 {
			parentId = doc.DocumentId
			continue
		}
		if err != nil && err != orm.ErrNoRows && err != models.ErrDataNotExist {
			return 0, fmt.Errorf("find parent document failed: %w", err)
		}
		if !autoCreate {
			return 0, fmt.Errorf("parent path does not exist: %s", strings.Join(prefix, "/"))
		}

		parent := models.NewDocument()
		parent.BookId = bookId
		parent.ParentId = parentId
		parent.Identify = identify
		parent.DocumentName = stripMarkdownExtension(segment)
		parent.Markdown = ""
		parent.Content = "<div class=\"whole-article-wrap\"></div>"
		parent.MemberId = memberId
		parent.ModifyAt = memberId
		parent.Version = time.Now().Unix()
		parent.IsOpen = 2
		if err := parent.InsertOrUpdate(); err != nil {
			return 0, fmt.Errorf("create parent path failed: %w", err)
		}
		parent.Lang = web.AppConfig.DefaultString("default_lang", "zh-cn")
		_ = parent.ReleaseContent()
		parentId = parent.DocumentId
	}
	return parentId, nil
}

func normalizeMarkdownImportPath(rawPath string) ([]string, error) {
	path := strings.ReplaceAll(strings.TrimSpace(rawPath), "\\", "/")
	path = strings.Trim(path, "/")
	if path == "" {
		return nil, fmt.Errorf("path is required")
	}
	parts := strings.Split(path, "/")
	segments := make([]string, 0, len(parts))
	for _, part := range parts {
		part = strings.TrimSpace(part)
		if part == "" || part == "." || part == ".." {
			return nil, fmt.Errorf("path contains invalid segment")
		}
		segments = append(segments, part)
	}
	return segments, nil
}

func renderImportedMarkdown(markdown string) string {
	extensions := blackfriday.CommonExtensions | blackfriday.AutoHeadingIDs
	html := blackfriday.Run([]byte(markdown), blackfriday.WithExtensions(extensions))
	return "<div class=\"markdown-article\">" + string(html) + "</div>"
}

func stripMarkdownExtension(name string) string {
	lower := strings.ToLower(name)
	switch {
	case strings.HasSuffix(lower, ".markdown"):
		return strings.TrimSpace(name[:len(name)-len(".markdown")])
	case strings.HasSuffix(lower, ".md"):
		return strings.TrimSpace(name[:len(name)-len(".md")])
	default:
		return strings.TrimSpace(name)
	}
}

func isValidMarkdownImportIdentify(identify string) bool {
	return len(identify) <= 100 && openAPIDocIdentifyPattern.MatchString(identify)
}

func makeMarkdownImportIdentify(segments []string) string {
	raw := strings.Join(segments, "-")
	slug := sanitizeMarkdownImportSlug(raw)
	if slug == "" {
		slug = "doc"
	}
	if slug[0] < 'a' || slug[0] > 'z' {
		slug = "doc-" + slug
	}

	hash := shortMarkdownImportHash(raw)
	maxSlugLen := 100 - len(hash) - 1
	if len(slug) > maxSlugLen {
		slug = strings.Trim(slug[:maxSlugLen], "-_.")
		if slug == "" || slug[0] < 'a' || slug[0] > 'z' {
			slug = "doc"
		}
	}
	return slug + "-" + hash
}

func sanitizeMarkdownImportSlug(raw string) string {
	raw = stripMarkdownExtension(strings.ToLower(raw))
	var b strings.Builder
	lastDash := false
	for _, r := range raw {
		valid := (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') || r == '_' || r == '.' || r == '-'
		if valid {
			b.WriteRune(r)
			lastDash = r == '-'
			continue
		}
		if !lastDash {
			b.WriteByte('-')
			lastDash = true
		}
	}
	return strings.Trim(b.String(), "-_.")
}

func shortMarkdownImportHash(raw string) string {
	h := fnv.New32a()
	_, _ = h.Write([]byte(raw))
	return fmt.Sprintf("%08x", h.Sum32())
}
