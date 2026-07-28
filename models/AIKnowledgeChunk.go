package models

import (
	"crypto/md5"
	"encoding/hex"
	"regexp"
	"strings"
	"time"

	"github.com/beego/beego/v2/client/orm"
	"github.com/beego/beego/v2/core/logs"
	"github.com/beego/beego/v2/server/web"
	"github.com/mindoc-org/mindoc/conf"
	"github.com/mindoc-org/mindoc/utils"
)

const (
	defaultAIChunkSize    = 900
	defaultAIChunkOverlap = 120
)

var markdownHeadingPattern = regexp.MustCompile(`^\s{0,3}#{1,6}\s+(.+?)\s*$`)

type AIKnowledgeChunk struct {
	ChunkId    int       `orm:"pk;auto;unique;column(chunk_id)" json:"chunk_id"`
	DocumentId int       `orm:"column(document_id);type(int);index" json:"document_id"`
	BookId     int       `orm:"column(book_id);type(int);index" json:"book_id"`
	ChunkIndex int       `orm:"column(chunk_index);type(int);index" json:"chunk_index"`
	ChunkTitle string    `orm:"column(chunk_title);size(500)" json:"chunk_title"`
	Content    string    `orm:"column(content);type(text)" json:"content"`
	ContentMd5 string    `orm:"column(content_md5);size(32);index" json:"content_md5"`
	WordCount  int       `orm:"column(word_count);type(int);default(0)" json:"word_count"`
	CreateTime time.Time `orm:"column(create_time);type(datetime);auto_now_add" json:"create_time"`
	ModifyTime time.Time `orm:"column(modify_time);type(datetime);auto_now" json:"modify_time"`
}

type AIKnowledgeEmbedding struct {
	ChunkId        int       `orm:"pk;column(chunk_id)" json:"chunk_id"`
	DocumentId     int       `orm:"column(document_id);type(int);index" json:"document_id"`
	BookId         int       `orm:"column(book_id);type(int);index" json:"book_id"`
	ContentMd5     string    `orm:"column(content_md5);size(32);index" json:"content_md5"`
	EmbeddingModel string    `orm:"column(embedding_model);size(128);index" json:"embedding_model"`
	EmbeddingDim   int       `orm:"column(embedding_dim);type(int);default(0)" json:"embedding_dim"`
	Embedding      string    `orm:"column(embedding);type(text)" json:"-"`
	CreateTime     time.Time `orm:"column(create_time);type(datetime);auto_now_add" json:"create_time"`
	ModifyTime     time.Time `orm:"column(modify_time);type(datetime);auto_now" json:"modify_time"`
}

type aiChunkDraft struct {
	Title   string
	Content string
}

func NewAIKnowledgeChunk() *AIKnowledgeChunk {
	return &AIKnowledgeChunk{}
}

func NewAIKnowledgeEmbedding() *AIKnowledgeEmbedding {
	return &AIKnowledgeEmbedding{}
}

func (item *AIKnowledgeChunk) TableName() string {
	return "ai_knowledge_chunks"
}

func (item *AIKnowledgeEmbedding) TableName() string {
	return "ai_knowledge_embeddings"
}

func (item *AIKnowledgeChunk) TableEngine() string {
	return "INNODB"
}

func (item *AIKnowledgeEmbedding) TableEngine() string {
	return "INNODB"
}

func (item *AIKnowledgeChunk) TableNameWithPrefix() string {
	return conf.GetDatabasePrefix() + item.TableName()
}

func (item *AIKnowledgeEmbedding) TableNameWithPrefix() string {
	return conf.GetDatabasePrefix() + item.TableName()
}

func EnsureAIKnowledgeEmbeddingTable() error {
	table := NewAIKnowledgeEmbedding().TableNameWithPrefix()
	sql := "CREATE TABLE IF NOT EXISTS `" + table + "` (" +
		"`chunk_id` int(11) NOT NULL," +
		"`document_id` int(11) NOT NULL," +
		"`book_id` int(11) NOT NULL," +
		"`content_md5` char(32) NOT NULL DEFAULT ''," +
		"`embedding_model` varchar(128) NOT NULL DEFAULT ''," +
		"`embedding_dim` int(11) NOT NULL DEFAULT 0," +
		"`embedding` longtext NOT NULL," +
		"`create_time` datetime NOT NULL," +
		"`modify_time` datetime NOT NULL," +
		"PRIMARY KEY (`chunk_id`)," +
		"KEY `idx_ai_embedding_document_id` (`document_id`)," +
		"KEY `idx_ai_embedding_book_id` (`book_id`)," +
		"KEY `idx_ai_embedding_content_md5` (`content_md5`)," +
		"KEY `idx_ai_embedding_model` (`embedding_model`)" +
		") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci"
	_, err := orm.NewOrm().Raw(sql).Exec()
	return err
}

func (item *AIKnowledgeEmbedding) DeleteByDocumentId(documentId int) error {
	if documentId <= 0 {
		return ErrInvalidParameter
	}
	if err := EnsureAIKnowledgeEmbeddingTable(); err != nil {
		return err
	}
	o := orm.NewOrm()
	_, err := o.QueryTable(item.TableNameWithPrefix()).Filter("document_id", documentId).Delete()
	return err
}

func (item *AIKnowledgeChunk) DeleteByDocumentId(documentId int) error {
	if documentId <= 0 {
		return ErrInvalidParameter
	}
	o := orm.NewOrm()
	_, err := o.QueryTable(item.TableNameWithPrefix()).Filter("document_id", documentId).Delete()
	return err
}

func (item *AIKnowledgeChunk) BuildForDocument(doc *Document) error {
	if doc == nil || doc.DocumentId <= 0 {
		return ErrInvalidParameter
	}

	if web.AppConfig.DefaultBool("ai_embedding_enabled", false) {
		if err := NewAIKnowledgeEmbedding().DeleteByDocumentId(doc.DocumentId); err != nil {
			logs.Warn("delete ai knowledge embeddings failed ->", doc.DocumentId, err)
		}
	}

	if err := item.DeleteByDocumentId(doc.DocumentId); err != nil {
		return err
	}

	content := chooseAIChunkSource(doc.Markdown, doc.Release, doc.Content)
	if strings.TrimSpace(content) == "" || doc.IsOpen == 2 {
		return nil
	}

	drafts := splitDocumentIntoAIChunks(doc.DocumentName, content)
	if len(drafts) == 0 {
		return nil
	}

	chunks := make([]*AIKnowledgeChunk, 0, len(drafts))
	seen := make(map[string]bool, len(drafts))
	for index, draft := range drafts {
		body := strings.TrimSpace(draft.Content)
		if body == "" {
			continue
		}
		hash := md5Text(body)
		if seen[hash] {
			continue
		}
		seen[hash] = true
		chunks = append(chunks, &AIKnowledgeChunk{
			DocumentId: doc.DocumentId,
			BookId:     doc.BookId,
			ChunkIndex: index,
			ChunkTitle: truncateString(strings.TrimSpace(draft.Title), 500),
			Content:    body,
			ContentMd5: hash,
			WordCount:  len([]rune(body)),
		})
	}

	if len(chunks) == 0 {
		return nil
	}

	o := orm.NewOrm()
	_, err := o.InsertMulti(100, chunks)
	return err
}

func RebuildAIKnowledgeChunksForDocument(documentId int) error {
	doc, err := NewDocument().Find(documentId)
	if err != nil {
		return err
	}
	return NewAIKnowledgeChunk().BuildForDocument(doc)
}

func InitializeMissingAIKnowledgeChunks(limit int) error {
	o := orm.NewOrm()
	docTable := NewDocument().TableNameWithPrefix()
	chunkTable := NewAIKnowledgeChunk().TableNameWithPrefix()

	sql := "SELECT d.* FROM " + docTable + " d LEFT JOIN " + chunkTable + " c ON c.document_id = d.document_id AND c.chunk_index = 0 AND c.chunk_title LIKE '% / outline' WHERE c.chunk_id IS NULL AND d.is_open <> 2 AND (d.markdown <> '' OR d.release <> '' OR d.content <> '') ORDER BY d.modify_time DESC"
	if limit > 0 {
		sql += " LIMIT ?"
	}

	var docs []*Document
	var err error
	if limit > 0 {
		_, err = o.Raw(sql, limit).QueryRows(&docs)
	} else {
		_, err = o.Raw(sql).QueryRows(&docs)
	}
	if err != nil {
		return err
	}

	for _, doc := range docs {
		if err := NewAIKnowledgeChunk().BuildForDocument(doc); err != nil {
			logs.Error("build ai knowledge chunks failed ->", doc.DocumentId, err)
		}
	}
	return nil
}

func chooseAIChunkSource(markdown, release, content string) string {
	if strings.TrimSpace(markdown) != "" {
		return markdown
	}
	if strings.TrimSpace(release) != "" {
		return utils.StripTags(release)
	}
	return utils.StripTags(content)
}

func splitDocumentIntoAIChunks(documentTitle, content string) []aiChunkDraft {
	content = strings.ReplaceAll(content, "\r\n", "\n")
	content = strings.ReplaceAll(content, "\r", "\n")

	maxSize := web.AppConfig.DefaultInt("ai_chunk_size", defaultAIChunkSize)
	if maxSize <= 0 {
		maxSize = defaultAIChunkSize
	}
	overlap := web.AppConfig.DefaultInt("ai_chunk_overlap", defaultAIChunkOverlap)
	if overlap < 0 {
		overlap = defaultAIChunkOverlap
	}
	if overlap >= maxSize {
		overlap = maxSize / 5
	}

	chunks := make([]aiChunkDraft, 0)
	sectionTitle := strings.TrimSpace(documentTitle)
	sectionLines := make([]string, 0)
	outline := make([]string, 0)

	flushSection := func() {
		sectionText := strings.TrimSpace(strings.Join(sectionLines, "\n"))
		if sectionText == "" {
			sectionLines = sectionLines[:0]
			return
		}
		for _, text := range splitTextByParagraph(sectionText, maxSize, overlap) {
			chunks = append(chunks, aiChunkDraft{
				Title:   sectionTitle,
				Content: buildChunkContent(sectionTitle, text),
			})
		}
		sectionLines = sectionLines[:0]
	}

	for _, line := range strings.Split(content, "\n") {
		if matches := markdownHeadingPattern.FindStringSubmatch(line); len(matches) == 2 {
			flushSection()
			heading := strings.TrimSpace(matches[1])
			if documentTitle != "" && heading != documentTitle {
				sectionTitle = documentTitle + " / " + heading
			} else {
				sectionTitle = heading
			}
			outline = append(outline, sectionTitle)
			continue
		}
		sectionLines = append(sectionLines, line)
	}
	flushSection()

	if len(chunks) == 0 {
		for _, text := range splitTextByParagraph(content, maxSize, overlap) {
			chunks = append(chunks, aiChunkDraft{
				Title:   documentTitle,
				Content: buildChunkContent(documentTitle, text),
			})
		}
	}
	chunks = append([]aiChunkDraft{buildOutlineChunk(documentTitle, outline, content, maxSize)}, chunks...)
	return chunks
}

func buildOutlineChunk(documentTitle string, outline []string, content string, maxSize int) aiChunkDraft {
	var b strings.Builder
	title := strings.TrimSpace(documentTitle)
	if title != "" {
		b.WriteString(title)
		b.WriteString("\n\n")
	}
	if len(outline) > 0 {
		b.WriteString("Document outline:\n")
		limit := len(outline)
		if limit > 120 {
			limit = 120
		}
		for _, item := range outline[:limit] {
			item = strings.TrimSpace(item)
			if item == "" {
				continue
			}
			b.WriteString("- ")
			b.WriteString(item)
			b.WriteString("\n")
		}
		b.WriteString("\n")
	}
	intro := truncateForChunk(strings.TrimSpace(content), maxSize)
	if intro != "" {
		b.WriteString("Document excerpt:\n")
		b.WriteString(intro)
	}
	outlineTitle := title
	if outlineTitle != "" {
		outlineTitle += " / outline"
	} else {
		outlineTitle = "outline"
	}
	return aiChunkDraft{
		Title:   outlineTitle,
		Content: strings.TrimSpace(b.String()),
	}
}

func splitTextByParagraph(text string, maxSize, overlap int) []string {
	paragraphs := strings.Split(text, "\n\n")
	result := make([]string, 0)
	var current strings.Builder

	flush := func() {
		part := strings.TrimSpace(current.String())
		if part != "" {
			result = append(result, part)
		}
		current.Reset()
	}

	for _, paragraph := range paragraphs {
		paragraph = strings.TrimSpace(paragraph)
		if paragraph == "" {
			continue
		}
		if len([]rune(paragraph)) > maxSize {
			flush()
			result = append(result, splitLongText(paragraph, maxSize, overlap)...)
			continue
		}
		nextLen := len([]rune(current.String())) + len([]rune(paragraph)) + 2
		if nextLen > maxSize {
			flush()
		}
		if current.Len() > 0 {
			current.WriteString("\n\n")
		}
		current.WriteString(paragraph)
	}
	flush()
	return result
}

func splitLongText(text string, maxSize, overlap int) []string {
	runes := []rune(strings.TrimSpace(text))
	if len(runes) <= maxSize {
		return []string{string(runes)}
	}
	result := make([]string, 0)
	step := maxSize - overlap
	if step <= 0 {
		step = maxSize
	}
	for start := 0; start < len(runes); start += step {
		end := start + maxSize
		if end > len(runes) {
			end = len(runes)
		}
		result = append(result, string(runes[start:end]))
		if end >= len(runes) {
			break
		}
	}
	return result
}

func truncateForChunk(text string, max int) string {
	runes := []rune(strings.TrimSpace(text))
	if max <= 0 || len(runes) <= max {
		return string(runes)
	}
	return string(runes[:max])
}

func buildChunkContent(title, content string) string {
	title = strings.TrimSpace(title)
	content = strings.TrimSpace(content)
	if title == "" {
		return content
	}
	return title + "\n\n" + content
}

func md5Text(text string) string {
	sum := md5.Sum([]byte(text))
	return hex.EncodeToString(sum[:])
}

func truncateString(text string, max int) string {
	runes := []rune(strings.TrimSpace(text))
	if len(runes) <= max {
		return string(runes)
	}
	return string(runes[:max])
}
